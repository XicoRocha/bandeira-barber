#!/usr/bin/env bash
# Cria o quadro Scrum no GitHub Projects, com um item (issue) por documento das entregas (1 a 28).
#
# Correr UMA vez, no Git Bash (Windows) ou num terminal, com o GitHub CLI (gh) instalado:
#   gh auth login
#   gh auth refresh -s project        # dá ao gh permissão para criar o quadro
#   DRY_RUN=1 bash docs/quadro/criar-quadro.sh   # primeiro só mostra o que vai fazer
#   bash docs/quadro/criar-quadro.sh             # depois cria mesmo
#
# Antes de correr: confirmem com o enunciado a numeração dos documentos 17 a 23 (lista DOCS em baixo).
# Os documentos 1 a 6 ficam fechados (concluídos), com um comentário a dizer que foram registados depois de feitos.
# Os 7 e 8 ficam abertos (revistos na E4), os 9 a 12 abertos (E4 em curso) e os 13 a 28 abertos (a fazer).

set -euo pipefail

REPO="XicoRocha/bandeira-barber"
OWNER="XicoRocha"
TITULO_QUADRO="Bandeira Barber — Scrum"
HOJE="$(date +%Y-%m-%d)"

run() {
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "[simulação] $*"
  else
    "$@"
  fi
}

# número | título | entrega | prazo | sprint | secção do relatório
DOCS=(
  "1|Ficha de ideia|E1|2026-11-08|Sprint 1|1.1, 1.2"
  "2|Objetivos|E1|2026-11-08|Sprint 1|1.3"
  "3|Ambiente de trabalho e papéis|E1|2026-11-08|Sprint 1|1.4"
  "4|Questão de investigação|E2|2026-11-15|Sprint 1|1.3"
  "5|Protocolo de pesquisa|E2|2026-11-15|Sprint 1|Anexo A"
  "6|Lista inicial de referências|E2|2026-11-15|Sprint 1|2.1, 6"
  "7|Matriz de literatura|E3|2026-11-22|Sprint 1|2.1"
  "8|Matriz de projetos similares ou concorrentes|E3|2026-11-22|Sprint 1|2.2"
  "9|Lacuna e contribuição|E4|2026-11-29|Sprint 1|2.3"
  "10|Metodologia|E4|2026-11-29|Sprint 1|1.4"
  "11|Riscos v1|E4|2026-11-29|Sprint 1|3.5"
  "12|Documento de enquadramento v1|E4|2026-11-29|Sprint 1|Cap. 1, 2.1–2.3, Anexo A"
  "13|Stakeholders e personas|E5|2026-12-06|Sprint 2|2.4"
  "14|Product Vision|E5|2026-12-06|Sprint 2|2.4"
  "15|Product Backlog|E5|2026-12-06|Sprint 2|2.5"
  "16|User Stories|E5|2026-12-06|Sprint 2|2.5"
  "17|Requisitos funcionais|E6|2026-12-13|Sprint 2|2.6"
  "18|Requisitos não funcionais|E6|2026-12-13|Sprint 2|2.7"
  "19|Casos de uso|E6|2026-12-13|Sprint 2|2.8"
  "20|Definition of Ready e Definition of Done|E6|2026-12-13|Sprint 2|1.4, Anexo B"
  "21|Modelo de domínio|E7|2026-12-20|Sprint 2|4.1"
  "22|Arquitetura e tecnologias|E7|2026-12-20|Sprint 2|3.1–3.3"
  "23|Wireframes, plano e casos de teste|E7|2026-12-20|Sprint 2|4.3, 4.4"
  "24|Estimativas|E8|2027-01-03|Sprint 2|3.4"
  "25|Riscos v2|E8|2027-01-03|Sprint 2|3.5"
  "26|Matriz de rastreabilidade|E8|2027-01-03|Sprint 2|2.9"
  "27|Roadmap e Sprint Backlog|E8|2027-01-03|Sprint 2|5.1"
  "28|Relatório consolidado|E8|2027-01-03|Sprint 2|Todo o relatório"
)

echo "== Etiquetas"
for e in E1 E2 E3 E4 E5 E6 E7 E8; do
  run gh label create "entrega:$e" --repo "$REPO" --color "1d76db" --force
done
run gh label create "documento" --repo "$REPO" --color "c5def5" --force

echo "== Sprints (milestones)"
run gh api "repos/$REPO/milestones" -f title="Sprint 1" -f due_on="2026-11-29T23:59:00Z" \
  -f description="Enquadramento e investigação (E1 a E4)" || echo "Sprint 1 já existe"
run gh api "repos/$REPO/milestones" -f title="Sprint 2" -f due_on="2027-01-03T23:59:00Z" \
  -f description="Especificação do produto (E5 a E8)" || echo "Sprint 2 já existe"

echo "== Quadro"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  NUM="N"
  run gh project create --owner "$OWNER" --title "$TITULO_QUADRO"
else
  NUM="$(gh project create --owner "$OWNER" --title "$TITULO_QUADRO" --format json --jq .number)"
fi
run gh project link "$NUM" --owner "$OWNER" --repo "$REPO"
run gh project edit "$NUM" --owner "$OWNER" --visibility PUBLIC

echo "== Itens"
for linha in "${DOCS[@]}"; do
  IFS='|' read -r n titulo entrega prazo sprint seccao <<<"$linha"
  num2="$(printf '%02d' "$n")"
  corpo="Documento $n da entrega $entrega (prazo: $prazo, 23:59). Secção do relatório: $seccao."
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    url="(url do item $n)"
    run gh issue create --repo "$REPO" --title "Doc $num2 — $titulo" --body "$corpo" \
      --label documento --label "entrega:$entrega" --milestone "$sprint"
  else
    url="$(gh issue create --repo "$REPO" --title "Doc $num2 — $titulo" --body "$corpo" \
      --label documento --label "entrega:$entrega" --milestone "$sprint")"
  fi
  run gh project item-add "$NUM" --owner "$OWNER" --url "$url"
  if (( n <= 6 )); then
    run gh issue close "$url" --comment "Concluído na entrega $entrega. Item registado no quadro a $HOJE, depois de feito (ver Retrospetiva do Sprint 1)."
  fi
done

echo
echo "Feito. Falta no browser (Projects > $TITULO_QUADRO > Settings > Status):"
echo "  1) renomear as colunas para: A fazer, Em curso, Em revisão, Concluído;"
echo "  2) pôr os docs 7 e 8 em 'Em revisão', os 9 a 12 em 'Em curso' e os 13 a 28 em 'A fazer';"
echo "  3) atribuir um responsável a cada item;"
echo "  4) copiar o URL do quadro para a Tabela 4 do relatório e para o README."
