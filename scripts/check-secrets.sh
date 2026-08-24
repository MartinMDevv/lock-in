#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Escáner de secretos y datos personales.
#
#   ./scripts/check-secrets.sh --staged   → revisa lo que está por commitearse
#   ./scripts/check-secrets.sh --all      → revisa todo lo versionado (usado en CI)
#
# Devuelve 1 si encuentra algo. El gancho de pre-commit lo usa para abortar.
#
# Para saltar una línea que da falso positivo (por ejemplo, documentación que
# menciona "service_role" a propósito), agrega el comentario:  secret-scan-ok
# ---------------------------------------------------------------------------
set -uo pipefail

ROJO=$'\033[0;31m'; AMARILLO=$'\033[0;33m'; VERDE=$'\033[0;32m'; NEUTRO=$'\033[0m'
hallazgos=0

modo="${1:---staged}"
case "$modo" in
  --staged) archivos=$(git diff --cached --name-only --diff-filter=ACMR) ;;
  --all)    archivos=$(git ls-files --cached --others --exclude-standard) ;;
  *) echo "Uso: $0 [--staged|--all]" >&2; exit 2 ;;
esac

[ -z "$archivos" ] && { echo "${VERDE}✓ Nada que revisar.${NEUTRO}"; exit 0; }

reportar() { # archivo, línea, motivo, contenido
  echo "${ROJO}✗ $1:$2${NEUTRO}  $3"
  echo "    ${AMARILLO}$(echo "$4" | cut -c1-100)${NEUTRO}"
  hallazgos=$((hallazgos + 1))
}

# --- 1. Archivos que no deben existir en el repo ----------------------------
while IFS= read -r archivo; do
  case "$(basename "$archivo")" in
    .env|.env.local|.env.development|.env.production|.env.development.local|.env.production.local)
      echo "${ROJO}✗ $archivo${NEUTRO}  archivo de entorno: jamás se commitea (solo .env.example)"
      hallazgos=$((hallazgos + 1)) ;;
    *.pem|*.key|*.p12|*.pfx|id_rsa|id_ed25519)
      echo "${ROJO}✗ $archivo${NEUTRO}  archivo de clave privada"
      hallazgos=$((hallazgos + 1)) ;;
  esac
done <<< "$archivos"

# --- 2. Patrones genéricos de credencial ------------------------------------
# Cada entrada: expresión regular ::: descripción
patrones_credencial=(
  'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}:::token JWT (clave de Supabase)'
  'sb_secret_[A-Za-z0-9_-]{10,}:::clave secreta de Supabase'
  'sbp_[A-Za-z0-9]{30,}:::token de acceso de Supabase'
  'gh[pousr]_[A-Za-z0-9]{30,}:::token de GitHub'
  'AKIA[0-9A-Z]{16}:::clave de acceso de AWS'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----:::clave privada'
  'VITE_[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD):::variable VITE_ con nombre de secreto (VITE_ queda expuesto en el bundle)'
)

# --- 3. Patrones personales, cargados desde un archivo LOCAL y NO versionado -
# .private-patterns está en .gitignore: la lista de tus datos privados
# nunca se publica. Una expresión regular por línea; # para comentarios.
patrones_personales=()
if [ -f .private-patterns ]; then
  while IFS= read -r linea; do
    [ -z "$linea" ] && continue
    case "$linea" in \#*) continue ;; esac
    patrones_personales+=("$linea:::dato personal (definido en .private-patterns)")
  done < .private-patterns
fi

todos=("${patrones_credencial[@]}" ${patrones_personales+"${patrones_personales[@]}"})

while IFS= read -r archivo; do
  [ -f "$archivo" ] || continue
  # se saltan binarios
  grep -Iq . "$archivo" 2>/dev/null || continue
  # el propio escáner contiene los patrones: no se revisa a sí mismo
  case "$archivo" in scripts/check-secrets.sh) continue ;; esac

  for entrada in "${todos[@]}"; do
    regex="${entrada%%:::*}"
    motivo="${entrada##*:::}"
    while IFS=: read -r num contenido; do
      [ -z "$num" ] && continue
      case "$contenido" in *secret-scan-ok*) continue ;; esac
      reportar "$archivo" "$num" "$motivo" "$contenido"
    done < <(grep -nE "$regex" "$archivo" 2>/dev/null)
  done
done <<< "$archivos"

echo
if [ "$hallazgos" -gt 0 ]; then
  echo "${ROJO}═══ $hallazgos hallazgo(s). Commit abortado. ═══${NEUTRO}"
  echo "Este repositorio es PÚBLICO: lo que entra al historial no se borra."
  echo "Saca el dato del archivo. Si es un falso positivo, agrega 'secret-scan-ok' en la línea."
  exit 1
fi
echo "${VERDE}✓ Sin secretos ni datos personales detectados.${NEUTRO}"
