{{/*
Shared template helpers
*/}}

{{/* App name — always coffee-shop */}}
{{- define "coffee-shop.name" -}}
coffee-shop
{{- end }}

{{/* Common labels applied to all resources */}}
{{- define "coffee-shop.labels" -}}
app: {{ include "coffee-shop.name" . }}
env: {{ .Values.env }}
{{- end }}
