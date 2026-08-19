#!/bin/bash
set -e

echo "=== EventHub Phase 2 run-all.sh ==="


# ============================================================
# Helper functions
# ============================================================

ensure_container_started() {
  local name="$1"

  if ! podman container exists "$name"; then
    echo "ERROR: Container '$name' does not exist."
    exit 1
  fi

  local running
  running="$(podman inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)"

  if [ "$running" = "true" ]; then
    echo "$name is running."
    return 0
  fi

  echo "ERROR: Container '$name' is not running."
  echo "----- $name logs -----"
  podman logs "$name" 2>&1 || true
  echo "----------------------"
  exit 1
}


ensure_container_exists_and_started() {
  local name="$1"
  shift

  if podman container exists "$name"; then
    if [ "$(podman inspect -f '{{.State.Running}}' "$name")" = "true" ]; then
      echo "$name container already running, continuing."
    else
      echo "$name container exists but is stopped. Starting it..."
      podman start "$name" >/dev/null
      ensure_container_started "$name"
    fi
  else
    echo "Creating $name container..."
    "$@"
    ensure_container_started "$name"
  fi
}


wait_for() {
  local name="$1"
  local timeout="$2"
  shift 2

  echo "Waiting for $name..."

  local waited=0

  until "$@" >/dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))

    if [ "$waited" -ge "$timeout" ]; then
      echo "ERROR: $name did not become ready within ${timeout}s"
      exit 1
    fi
  done

  echo "$name is ready (${waited}s)."
}


# ============================================================
# 1. Infrastructure containers
# ============================================================

echo ""
echo "=== Starting Infrastructure ==="


echo "Starting MySQL..."
podman volume create mysql-data >/dev/null 2>&1 || true

ensure_container_exists_and_started "mysql" \
  podman run -d \
    --name mysql \
    --network host \
    -v mysql-data:/var/lib/mysql \
    -e MYSQL_ROOT_PASSWORD=password123 \
    -e MYSQL_DATABASE=eventhub_catalog \
    mysql:8.4


echo "Starting PostgreSQL..."
podman volume create postgres-data >/dev/null 2>&1 || true

ensure_container_exists_and_started "postgres" \
  podman run -d \
    --name postgres \
    --network host \
    -v postgres-data:/var/lib/postgresql/data \
    -e POSTGRES_USER=eventhub \
    -e POSTGRES_PASSWORD=eventhub \
    -e POSTGRES_DB=eventhub_auth \
    postgres:16


echo "Starting MongoDB..."
podman volume create mongo-data >/dev/null 2>&1 || true

ensure_container_exists_and_started "mongo" \
  podman run -d \
    --name mongo \
    --network host \
    -v mongo-data:/data/db \
    mongo:7


echo "Starting Redis..."
podman volume create redis-data >/dev/null 2>&1 || true

ensure_container_exists_and_started "redis" \
  podman run -d \
    --name redis \
    --network host \
    -v redis-data:/data \
    redis:7-alpine


echo "Starting RabbitMQ..."
podman volume create rabbitmq-data >/dev/null 2>&1 || true

ensure_container_exists_and_started "rabbitmq" \
  podman run -d \
    --name rabbitmq \
    --network host \
    -v rabbitmq-data:/var/lib/rabbitmq \
    rabbitmq:4-management


# ============================================================
# 2. Wait for infrastructure
# ============================================================

echo ""
echo "=== Waiting for Infrastructure ==="


wait_for "MySQL" 60 \
  podman exec mysql \
  mysqladmin ping -h 127.0.0.1 -uroot -ppassword123 --silent


wait_for "PostgreSQL" 60 \
  podman exec postgres \
  pg_isready -U eventhub


wait_for "MongoDB" 60 \
  podman exec mongo \
  mongosh --quiet --eval "db.runCommand({ping:1}).ok"


wait_for "Redis" 30 \
  podman exec redis \
  redis-cli ping


wait_for "RabbitMQ" 60 \
  podman exec rabbitmq \
  rabbitmq-diagnostics -q ping


# ============================================================
# 3. Build service images
# ============================================================

echo ""
echo "=== Building Service Images ==="


podman build --network=host \
  -t eventhub-catalog \
  services/legacy-catalog-java


podman build --network=host \
  -t eventhub-auth \
  services/auth-service-node


podman build --network=host \
  -t eventhub-booking \
  services/booking-service-python


podman build --network=host \
  -t eventhub-notification \
  services/notification-worker-go


podman build --network=host \
  -t eventhub-ai-insight \
  services/ai-insight-service-python


podman build --network=host \
  -t eventhub-analytics \
  services/analytics-service-python


podman build --network=host \
  -t eventhub-frontend \
  frontend


# ============================================================
# 4. Start Catalog
# ============================================================

echo ""
echo "Starting catalog..."

if podman container exists catalog; then

  if [ "$(podman inspect -f '{{.State.Running}}' catalog)" = "true" ]; then
    echo "Catalog already running, continuing."
  else
    echo "Catalog exists but is stopped. Starting it..."
    podman start catalog >/dev/null
  fi

else

  podman run -d \
    --name catalog \
    --network host \
    -e SPRING_DATASOURCE_URL="jdbc:mysql://127.0.0.1:3306/eventhub_catalog" \
    -e SPRING_DATASOURCE_USERNAME=root \
    -e SPRING_DATASOURCE_PASSWORD=password123 \
    --health-cmd="curl -f http://localhost:8081/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-start-period=30s \
    --health-retries=3 \
    eventhub-catalog

fi

ensure_container_started catalog


# ============================================================
# 5. Start Auth
# ============================================================

echo ""
echo "Starting auth..."

if podman container exists auth; then

  if [ "$(podman inspect -f '{{.State.Running}}' auth)" = "true" ]; then
    echo "Auth already running, continuing."
  else
    echo "Auth exists but is stopped. Starting it..."
    podman start auth >/dev/null
  fi

else

  podman run -d \
    --name auth \
    --network host \
    -e PGHOST=127.0.0.1 \
    -e PGPORT=5432 \
    -e PGUSER=eventhub \
    -e PGPASSWORD=eventhub \
    -e PGDATABASE=eventhub_auth \
    -e JWT_SECRET=change-me-in-every-environment \
    --health-cmd="curl -f http://localhost:8082/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-start-period=15s \
    --health-retries=3 \
    eventhub-auth

fi

ensure_container_started auth


# ============================================================
# 6. Wait for Catalog + Auth
# ============================================================

wait_for "Catalog service" 60 \
  podman exec catalog \
  curl -sf http://localhost:8081/health


wait_for "Auth service" 60 \
  podman exec auth \
  curl -sf http://localhost:8082/health


# ============================================================
# 7. Start AI Insight
# ============================================================

echo ""
echo "Starting AI insight..."

if podman container exists ai-insight; then

  if [ "$(podman inspect -f '{{.State.Running}}' ai-insight)" = "true" ]; then
    echo "AI insight already running, continuing."
  else
    echo "AI insight exists but is stopped. Starting it..."
    podman start ai-insight >/dev/null
  fi

else

  podman run -d \
    --name ai-insight \
    --network host \
    --health-cmd="curl -f http://localhost:8084/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-start-period=15s \
    --health-retries=3 \
    eventhub-ai-insight

fi

ensure_container_started ai-insight


wait_for "AI insight service" 60 \
  podman exec ai-insight \
  curl -sf http://localhost:8084/health


# ============================================================
# 8. Start Booking
# ============================================================

echo ""
echo "Starting booking..."

if podman container exists booking; then

  if [ "$(podman inspect -f '{{.State.Running}}' booking)" = "true" ]; then
    echo "Booking already running, continuing."
  else
    echo "Booking exists but is stopped. Starting it..."
    podman start booking >/dev/null
  fi

else

  podman run -d \
    --name booking \
    --network host \
    -e MONGO_URI="mongodb://127.0.0.1:27017" \
    -e MONGO_DB=eventhub_bookings \
    -e RABBITMQ_URL="amqp://guest:guest@127.0.0.1:5672/" \
    -e RABBITMQ_QUEUE=bookings \
    -e AI_INSIGHT_URL="http://127.0.0.1:8084" \
    --health-cmd="curl -f http://localhost:8083/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-start-period=15s \
    --health-retries=3 \
    eventhub-booking

fi

ensure_container_started booking


wait_for "Booking service" 60 \
  podman exec booking \
  curl -sf http://localhost:8083/health


# ============================================================
# 9. Start Notification Worker
# ============================================================

echo ""
echo "Starting notification worker..."

if podman container exists notification; then

  if [ "$(podman inspect -f '{{.State.Running}}' notification)" = "true" ]; then
    echo "Notification worker already running, continuing."
  else
    echo "Notification worker exists but is stopped. Starting it..."
    podman start notification >/dev/null
  fi

else

  podman run -d \
    --name notification \
    --network host \
    -e RABBITMQ_URL="amqp://guest:guest@127.0.0.1:5672/" \
    -e RABBITMQ_QUEUE=bookings \
    eventhub-notification

fi

ensure_container_started notification


# ============================================================
# 10. Start Analytics
# ============================================================

echo ""
echo "Starting analytics API..."

if podman container exists analytics; then

  if [ "$(podman inspect -f '{{.State.Running}}' analytics)" = "true" ]; then
    echo "Analytics already running, continuing."
  else
    echo "Analytics exists but is stopped. Starting it..."
    podman start analytics >/dev/null
  fi

else

  podman run -d \
    --name analytics \
    --network host \
    -e REDIS_URL="redis://127.0.0.1:6379/0" \
    -e BOOKING_SERVICE_URL="http://127.0.0.1:8083" \
    -e CATALOG_SERVICE_URL="http://127.0.0.1:8081" \
    -e SNAPSHOT_KEY="analytics:snapshot" \
    --health-cmd="curl -f http://localhost:8085/health || exit 1" \
    --health-interval=10s \
    --health-timeout=5s \
    --health-start-period=15s \
    --health-retries=3 \
    eventhub-analytics

fi

ensure_container_started analytics


wait_for "Analytics service" 60 \
  podman exec analytics \
  curl -sf http://localhost:8085/health


# ============================================================
# 11. Start Frontend
# ============================================================

echo ""
echo "Starting frontend..."

if podman container exists frontend; then

  if [ "$(podman inspect -f '{{.State.Running}}' frontend)" = "true" ]; then
    echo "Frontend already running, continuing."
  else
    echo "Frontend exists but is stopped. Starting it..."
    podman start frontend >/dev/null
  fi

else

  podman run -d \
    --name frontend \
    --network host \
    eventhub-frontend

fi

ensure_container_started frontend


# ============================================================
# 12. Run analytics job once
# ============================================================

echo ""
echo "Running analytics job..."

podman run --rm \
  --network host \
  -e REDIS_URL="redis://127.0.0.1:6379/0" \
  -e BOOKING_SERVICE_URL="http://127.0.0.1:8083" \
  -e CATALOG_SERVICE_URL="http://127.0.0.1:8081" \
  -e SNAPSHOT_KEY="analytics:snapshot" \
  eventhub-analytics \
  python job.py


# ============================================================
# 13. Final verification
# ============================================================

echo ""
echo "=== Final container status ==="

podman ps \
  --filter name=mysql \
  --filter name=postgres \
  --filter name=mongo \
  --filter name=redis \
  --filter name=rabbitmq \
  --filter name=catalog \
  --filter name=auth \
  --filter name=ai-insight \
  --filter name=booking \
  --filter name=notification \
  --filter name=analytics \
  --filter name=frontend


echo ""
echo "=== All services started successfully ==="
echo "Frontend:   http://localhost:3000"
echo "Catalog:    http://localhost:8081/health"
echo "Auth:       http://localhost:8082/health"
echo "Booking:    http://localhost:8083/health"
echo "AI Insight: http://localhost:8084/health"
echo "Analytics:  http://localhost:8085/health"