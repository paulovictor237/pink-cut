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

---

## 🏗️ Arquitetura
A arquitetura do projeto é composta pelas seguintes tecnologias principais:
* **Frontend:** React para construção de uma interface altamente interativa, responsiva e alinhada ao design *aesthetic*.
* **Desktop Wrapper:** Tauri para garantir um aplicativo leve, seguro, multiplataforma e com excelente performance nativa.
* **Transcrição / IA Local:** Uso do modelo local **`parakeet-tdt-0.6b-v3-int8`** para realizar a transcrição de áudio e inteligência de forma local e privada.

---

## 🔍 Características Específicas
* **Representação de Silêncios:** É utilizado o símbolo musical **Quarter Rest (𝄾)** para representar visualmente as pausas e silêncios ao longo do texto transcrito.
