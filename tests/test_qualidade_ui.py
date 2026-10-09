"""Guardas de qualidade de UI/acessibilidade: se alguém (ou eu) estragar algo
disso no futuro, estes testes falham — contraste, fonte mínima, ícones, rótulos."""
import glob
import os
import re

SRC = os.path.join(os.path.dirname(__file__), "..", "src")


def ler(*partes):
    with open(os.path.join(SRC, *partes), encoding="utf-8") as f:
        return f.read()


CSS = ler("style.css")
HTML = ler("index.html")
JS = {os.path.basename(p): open(p, encoding="utf-8").read()
      for p in glob.glob(os.path.join(SRC, "js", "*.js"))
      if "verificar_frontend" not in p and not p.endswith(".test.js")}


def sem_comentarios_js(s):
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    return re.sub(r"(?<!:)//.*$", "", s, flags=re.M)


# ── contraste ────────────────────────────────────────────────────────────────
def lum(h):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contraste(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def misturar(a, b, peso):
    h = lambda x: [int(x.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    A, B = h(a), h(b)
    return "#%02x%02x%02x" % tuple(round(A[i] * peso + B[i] * (1 - peso)) for i in range(3))


def variaveis(seletor):
    m = re.search(seletor + r"\s*\{(.*?)\n\}", CSS, re.S)
    assert m, f"bloco {seletor} não encontrado"
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;", m.group(1)))


CLARO = variaveis(r":root")
ESCURO = {**CLARO, **variaveis(r':root\[data-theme="dark"\]')}
TEXTOS = ["text", "text2", "text3", "accent-text", "red", "green", "pause"]
FUNDOS = ["bg", "surface", "surface2", "surface3"]


def _checar_textos(tema, nome):
    falhas = []
    for t in TEXTOS:
        for f in FUNDOS:
            c = contraste(tema[t], tema[f])
            if c < 4.5:
                falhas.append(f"{nome}: {t} {tema[t]} sobre {f} {tema[f]} = {c:.2f}")
    assert not falhas, "\n".join(falhas)


def test_texto_tem_contraste_minimo_no_tema_claro():
    _checar_textos(CLARO, "claro")


def test_texto_tem_contraste_minimo_no_tema_escuro():
    _checar_textos(ESCURO, "escuro")


def test_branco_sobre_botoes_preenchidos_passa_em_ambos_os_temas():
    for nome, tema in (("claro", CLARO), ("escuro", ESCURO)):
        for token in ("accent-fill", "red-fill", "green-fill"):
            c = contraste("#ffffff", tema[token])
            assert c >= 4.5, f"{nome}: branco sobre {token} {tema[token]} = {c:.2f}"


def _cores_de_categoria():
    m = re.search(r"const COLORS = \[(.*?)\];", JS["categories.js"], re.S)
    return re.findall(r"#[0-9a-fA-F]{6}", m.group(1))


def test_fundo_tingido_pela_materia_mantem_texto_legivel_em_toda_a_paleta():
    peso = float(re.search(r"blendHex\(corCategoria,\s*corBase,\s*([\d.]+)\)", JS["timer.js"]).group(1))
    cores = _cores_de_categoria()
    assert len(cores) >= 10
    falhas = []
    for nome, tema in (("claro", CLARO), ("escuro", ESCURO)):
        for cor in cores:
            fundo = misturar(cor, tema["bg"], peso)
            for t in ("text2", "text3"):
                c = contraste(tema[t], fundo)
                if c < 4.5:
                    falhas.append(f"{nome}: {t} sobre fundo tingido de {cor} = {c:.2f}")
    assert not falhas, "\n".join(falhas)


def test_paleta_de_materias_nao_usa_cores_de_estado():
    # vermelho, verde e azul ficam reservados pra sucesso/erro/informação
    proibidas = {"#f87171", "#34d399", "#60a5fa", "#4ade80", "#f43f5e", "#38bdf8"}
    assert not (proibidas & set(c.lower() for c in _cores_de_categoria()))


# ── tipografia ───────────────────────────────────────────────────────────────
def _tamanhos(texto):
    out = []
    for m in re.finditer(r"font-size:\s*([\d.]+)(rem|px)", texto):
        v = float(m.group(1))
        out.append(v * 16 if m.group(2) == "rem" else v)
    return out


def test_nenhuma_fonte_abaixo_de_12px_no_css_html_e_js():
    abaixo = [s for s in _tamanhos(CSS) + _tamanhos(HTML) + [x for js in JS.values() for x in _tamanhos(js)] if s < 11.99]
    assert not abaixo, f"tamanhos abaixo de 12px: {sorted(set(abaixo))}"


def test_escala_tipografica_enxuta():
    distintos = sorted({round(s, 1) for s in _tamanhos(CSS)})
    assert len(distintos) <= 9, f"{len(distintos)} tamanhos distintos: {distintos}"


def test_rotulos_nao_usam_caixa_alta():
    assert "text-transform:uppercase" not in CSS.replace(" ", "")


def test_numeros_usam_algarismos_tabulares():
    assert "tabular-nums" in CSS


# ── padrões de interação ────────────────────────────────────────────────────
def test_sem_alert_nem_confirm_nativos():
    for nome, js in JS.items():
        limpo = sem_comentarios_js(js)
        assert not re.search(r"(?<![\w.])(alert|confirm)\(", limpo), f"{nome} ainda usa alert/confirm nativo"


EMOJI = re.compile("[\u2190-\u2BFF\U0001F000-\U0001FAFF\uFF0B]")


def test_sem_emoji_ou_simbolo_como_icone_no_html():
    html = re.sub(r"<!--.*?-->", "", HTML, flags=re.S)
    assert not EMOJI.findall(html), set(EMOJI.findall(html))


def test_sem_emoji_ou_simbolo_como_icone_no_js():
    for nome, js in JS.items():
        achados = EMOJI.findall(sem_comentarios_js(js))
        assert not achados, f"{nome}: {set(achados)}"


def _botoes(texto):
    return re.findall(r"<button\b([^>]*)>(.*?)</button>", texto, re.S)


def _so_icone(interno):
    t = re.sub(r"\$\{\s*ico\([^)]*\)\s*\}", "", interno)
    t = re.sub(r"<svg.*?</svg>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    return not t.strip()


def test_botoes_so_com_icone_tem_aria_label():
    sem = []
    for origem, texto in [("index.html", HTML)] + list(JS.items()):
        for attrs, interno in _botoes(texto):
            if _so_icone(interno) and "aria-label" not in attrs:
                sem.append(f"{origem}: <button{attrs[:70]}>")
    assert not sem, "\n".join(sem)


def test_icones_usados_existem_no_sprite():
    sprite = set(re.findall(r'<symbol id="i-([\w-]+)"', HTML))
    assert len(sprite) >= 15
    usados = set(re.findall(r'href="#i-([\w-]+)"', HTML))
    for js in JS.values():
        usados |= set(re.findall(r"ico\('([\w-]+)'", js))
    assert usados, "nenhum ícone em uso?"
    assert not (usados - sprite), f"ícones usados mas não definidos: {usados - sprite}"


# ── acessibilidade estrutural ───────────────────────────────────────────────
def test_rotulos_estao_associados_aos_campos():
    ids = set(re.findall(r'\bid="([^"]+)"', HTML))
    fors = re.findall(r'<label[^>]*\bfor="([^"]+)"', HTML)
    assert len(fors) >= 12, f"só {len(fors)} labels com for="
    assert not [f for f in fors if f not in ids], "label aponta pra id inexistente"


def test_foco_de_teclado_visivel():
    assert ":focus-visible" in CSS


def test_tem_media_query_e_respeita_reduced_motion():
    assert "@media (max-width" in CSS
    assert "prefers-reduced-motion" in CSS


def test_conteudo_principal_tem_largura_maxima():
    assert re.search(r"\.content\s*>\s*\*\s*\{[^}]*max-width:\s*\d{3,4}px", CSS)


def test_cartoes_sao_chapados_sem_gradiente():
    assert "linear-gradient(160deg" not in CSS


def test_placeholder_da_nota_nao_e_de_uma_area_especifica():
    assert "Crimes contra a vida" not in HTML


# ── regressões encontradas na revisão visual ────────────────────────────────
def test_pontos_de_cor_nao_tem_halo_em_currentcolor():
    # currentColor num box-shadow usa a cor do TEXTO, não a do ponto: vira um halo sujo
    assert not re.search(r"box-shadow:[^;}]*currentColor", CSS)


def test_anel_de_progresso_fica_oculto_com_o_timer_parado():
    # traço arredondado de comprimento zero aparece como um pontinho no topo do anel
    assert re.search(r"\.timer-card:not\(\.timer-running\):not\(\.timer-paused\)\s+\.ring-fill\{opacity:0\}", CSS)


def test_modo_estudando_e_uma_coluna_centralizada():
    assert re.search(r"\.timer-card\.timer-running,\.timer-card\.timer-paused\{[^}]*display:flex;flex-direction:column;align-items:center", CSS)


def test_texto_do_chip_e_do_bloco_nao_quebra_linha():
    assert re.search(r"#badge-name\{[^}]*white-space:nowrap", CSS)
    assert 'class="block-text"' in HTML


def test_nenhum_arquivo_de_teste_dentro_de_src():
    # arquivos de teste têm exemplos "ruins" de propósito (ex.: um ícone que não existe);
    # dentro de src/ eles confundem as checagens e o `node --test` nem chega a rodá-los
    perdidos = sorted(
        os.path.relpath(p, SRC)
        for p in glob.glob(os.path.join(SRC, "**", "*.test.js"), recursive=True)
        + glob.glob(os.path.join(SRC, "**", "test_*.py"), recursive=True)
    )
    assert not perdidos, f"Arquivos de teste no lugar errado (devem ficar em tests/, não em src/): {perdidos}"


def test_cabecalho_e_filtros_nao_estouram_em_tela_estreita():
    # o menu ganhou a 4ª aba; em 420px ele passava da borda e criava rolagem lateral na página inteira
    blocos = re.findall(r"@media \(max-width: 560px\)\{(.*?)\n\}", CSS, re.S)   # há mais de um bloco com esse limite
    assert blocos, "faltou o bloco @media (max-width: 560px)"
    bloco = "\n".join(blocos)
    assert re.search(r"\.header-nav\{[^}]*overflow-x:auto", bloco)
    assert re.search(r"\.period-tabs\{[^}]*overflow-x:auto", bloco)


def test_campos_do_formulario_limpam_o_erro_ao_serem_editados():
    for campo, controle in (("enunciado", "qm-enunciado"), ("assunto", "qm-assunto"), ("banca", "qm-banca")):
        padrao = rf'id="{controle}"[^>]*oninput="Questoes\.editou\(\'{campo}\'\)"'
        assert re.search(padrao, HTML), f"{controle} não limpa o erro ao digitar"


def test_separador_do_assunto_some_em_tela_estreita():
    blocos = re.findall(r"@media \(max-width: 960px\)\{(.*?)\n\}", CSS, re.S)
    assert any(".q-assunto::before{display:none}" in b for b in blocos)


def test_painel_de_desempenho_fica_acima_dos_filtros():
    assert 'id="q-painel"' in HTML
    assert HTML.index('id="q-painel"') < HTML.index('id="q-filtros"')


def test_texto_da_questao_e_justificado_e_a_tela_de_resolver_tem_largura_de_leitura():
    regra = re.search(r"\.q-enunciado\{([^}]*)\}", CSS).group(1)
    assert "text-align:justify" in regra and "hyphens:auto" in regra
    assert re.search(r"\.q-alt-texto\{[^}]*text-align:justify", CSS)
    assert re.search(r"#q-tela-refazer\{[^}]*max-width:\d+px", CSS)


def test_a_linha_resumo_repetida_saiu_e_o_leitor_de_tela_continua_sendo_avisado():
    assert ".q-resumo" not in CSS
    assert re.search(r"\.sr-only\{", CSS)