# Pink Cut — Arquitetura do Projeto

## 📌 O que é?
O **Pink Cut** é um editor de vídeo inovador inspirado no [Descript](https://www.descript.com/), focado em edição baseada em texto através de transcrição automática.

### 🎯 Objetivo
Permitir a edição completa de vídeos diretamente através do texto transcrito, facilitando cortes e refinamentos rápidos.

---

## 🛠️ Principais Ferramentas
* **Filter Words:** Detecção e remoção automática de palavras de preenchimento (ex: "hum", "tipo", "né").
* **Double Takes:** Identificação e corte de repetições ou erros de gravação.
* **Silence Cuts:** Detecção e corte inteligente de silêncios e pausas no áudio.

---

## 🎨 Estilo Visual (Design)
Inspirado nos conceitos de **Studygram** e **Bujo** (*Bullet Journal*), o design do app possui uma estética charmosa e muito organizada:
* **Visual Aesthetic:** Aparência fofa, aconchegante e amigável.
* **Paleta de Cores:** Uso mandatório/sempre usar tons pastel e suaves.
* **Elementos de Papelaria:** Uso de texturas de papel, colagens, caligrafia, post-its, marca-textos e adesivos virtuais (*stickers*).
* **Layout Clean:** Organização limpa e estruturada baseada em grades (*grids*) e marcadores de tarefas (*bullets*).
* **Minimalismo Funcional (estilo Zed):** A interface deve ser **minimalista**, priorizando clareza e espaço negativo, à semelhança do [Zed Editor](https://zed.dev/). Menus e barras de ferramentas podem ser **apenas icônicos** (sem label visível), especialmente ações frequentes (play, cortar, undo/redo, microfone). O rótulo aparece via **tooltip pastel** ao hover/focus, mantendo o visual *clean* sem perder a acessibilidade. O charme Studygram/Bujo fica nas **cores, stickers e texturas**, não no excesso de elementos na tela.
  * **Regra prática:** se a ação é primária e conhecida (tocar, gravar, salvar) → ícone + tooltip. Se é uma ação de configuração ou menos óbvia → ícone + label visível ou `Sheet`/`Popover` dedicado.
  * **Inspiração direta:** Zed usa tipografia mono, ícones finos e bastante respiro — Pink Cut faz o mesmo, mas com **cores pastel e stickers** no lugar do cinza.

### 🧭 Layout da Interface
A interface do Pink Cut segue um layout fixo em **três faixas** (header / conteúdo / footer), inspirado em editores profissionais (Zed, VS Code, Descript) mas com a leveza Studygram/Bujo.

* **Header (topo):** faixa fina com altura enxuta, alinhada à esquerda e à direita.
  * **🩷 Canto superior esquerdo:** ícone do **GitHub** que abre o repositório do projeto no navegador (`https://github.com/...`/pink-cut). É o único ponto de saída do app e deve ser discreto, mas sempre visível.
  * **Centro / direita:** **botões de ação** apenas icônicos (desfazer, refazer, exportar, gravar, microfone, etc.) + **informações do vídeo** carregado (duração, resolução, nome do arquivo). Tudo com tooltip pastel no hover.
* **Conteúdo (meio):** área de trabalho principal, onde fica a transcrição, o player e os painéis.
  * Os **menus** (Arquivo, Editar, Visualizar, Configurações, Ajudar, etc.) **não** ficam no topo — eles vivem no **footer**.
  * Cada menu **abre uma sidebar**: pode ser à **esquerda** (ex.: navegação de projetos, lista de cenas) ou à **direita** (ex.: propriedades, configurações do projeto, atalhos). A escolha do lado é semântica: *navegação/estrutura* à esquerda, *propriedades/ajustes* à direita.
  * As sidebars são **persistentes enquanto o menu está ativo** e fecham ao clicar fora, em Esc, ou no ícone do footer novamente.
* **Footer (rodapé):** barra fina e fixa com **apenas ícones** — sem label visível, seguindo a regra de "ícone + tooltip pastel" definida no estilo visual.
  * Cada ícone do footer = um menu (Arquivo, Editar, Visualizar, Inserir, Configurações, Ajudar, etc.).
  * O ícone ativo fica destacado com a cor primária pastel + um pequeno "sticker" ou underline discreto indicando que a sidebar correspondente está aberta.
  * Estado hover/disabled segue as convenções do shadcn + paleta pastel.

**Resumo visual:**
```
┌─────────────────────────────────────────────────────────┐
│  🐙 GitHub     ⏪ ⏩ 🎙️ 💾    🩷 video.mp4 · 02:34 · 1080p │  ← Header
├─────────────────────────────────────────────────────────┤
│ [Sidebar E]   [Conteúdo principal + player]   [Sidebar D]│
├─────────────────────────────────────────────────────────┤
│   📁  ✏️  👁️  ➕  ⚙️  ❓                            [•]    │  ← Footer (só ícones)
└─────────────────────────────────────────────────────────┘
```

**Regras duras:**
1. ❌ Nenhum menu de texto na barra superior.
2. ❌ Nenhum label visível no footer.
3. ✅ Toda ação do footer = ícone + tooltip pastel + abre uma sidebar (E ou D).
4. ✅ Header carrega ações de edição (undo/redo/etc.) e info do vídeo, **nunca** menus.
5. ✅ O ícone do GitHub é o **único elemento de saída externa** do app.

---

## 🏗️ Arquitetura
A arquitetura do projeto é composta pelas seguintes tecnologias principais:
* **Frontend:** React para construção de uma interface altamente interativa, responsiva e alinhada ao design *aesthetic*.
* **Desktop Wrapper:** Tauri para garantir um aplicativo leve, seguro, multiplataforma e com excelente performance nativa.
* **Transcrição / IA Local:** Uso do modelo local **`parakeet-tdt-0.6b-v3-int8`** para realizar a transcrição de áudio e inteligência de forma local e privada.

### 🧩 Biblioteca de Componentes UI — shadcn/ui
A biblioteca de componentes padrão do projeto é **[shadcn/ui](https://ui.shadcn.com/)** (construída sobre Radix UI + Tailwind).

**Regra de ouro:** *Sempre baixar/gerar o componente via CLI do shadcn **antes** de tentar criar um do zero.* Somente após ter o componente em mãos é que se ajusta o visual para o estilo *aesthetic/pastel/bujo* do Pink Cut.

**Workflow obrigatório:**
1. 🔍 Verificar se o shadcn já oferece o componente necessário (Button, Input, Select, Dialog, Tooltip, etc.).
2. ⬇️ Rodar `bunx shadcn@latest add <componente>` para adicioná-lo ao projeto.
3. 🎨 Customizar **apenas o visual** (variantes, classes Tailwind, CSS variables) para alinhar com a paleta pastel e os elementos de papelaria.
4. 🧱 Só criar componente customizado (sem passar pelo shadcn) se for algo genuinamente domain-specific do Pink Cut (ex.: `TranscriptionLine`, `SilenceRest`, `StickerBadge`).

**Por que shadcn/ui?**
* **Código no projeto, não em `node_modules`:** os componentes ficam em `src/components/ui/` e podem ser editados livremente — essencial para o nível de customização visual exigido pelo estilo *aesthetic*.
* **Acessibilidade "de graça":** Radix cuida de keyboard nav, focus traps, ARIA, portais.
* **Compatibilidade:** funciona nativamente com Tailwind 4 e Vite + React 18.
* **Padronização:** evita que cada dev implemente Tooltip/Select/Dialog de um jeito diferente.

**Componentes base que provavelmente serão necessários:**
`button`, `input`, `textarea`, `select`, `switch`, `slider`, `tooltip`, `popover`, `dropdown-menu`, `dialog`, `card`, `badge`, `alert`, `sonner` (toasts).

---

## 🔍 Características Específicas
* **Representação de Silêncios:** É utilizado o símbolo musical **Quarter Rest (𝄾)** para representar visualmente as pausas e silêncios ao longo do texto transcrito.
