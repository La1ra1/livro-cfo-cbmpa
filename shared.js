  const API = 'https://api.cfo-cbmpa.com.br';

  // ── UTILS ──────────────────────────────────
  const $ = id => document.getElementById(id);

  function token() { return localStorage.getItem('token'); }

  // ── CURSO ATIVO ────────────────────────────
  // Quando o usuário tem matrícula/coordenação em mais de um curso, ele
  // escolhe qual está ativo no badge do topbar; o id escolhido é enviado
  // como curso_id nos lançamentos e nas listagens restritas por curso, pra
  // desambiguar a qual curso/matrícula a ação ou a visualização se refere.
  window._meusCursos = [];

  function cursoAtivoId() {
    const v = localStorage.getItem('curso_ativo_id');
    return v ? Number(v) : undefined;
  }

  // querystring pronta pra colar num fetch: '?curso_id=8' ou '' se não houver curso ativo
  function qsCurso(prefix = '?') {
    const id = cursoAtivoId();
    return id != null ? `${prefix}curso_id=${id}` : '';
  }

  function tipoCursoLabel(tipo) {
    const map = { formacao: 'Formação', especializacao: 'Especialização', habilitacao: 'Habilitação' };
    return map[tipo] || tipo;
  }

  function _aplicarCursoBadge(cursoId) {
    const badge = $('top-curso-badge');
    const label = $('top-curso-badge-label');
    if (badge && label) {
      const c = window._meusCursos.find(x => x.curso_id === cursoId);
      label.textContent = c ? (c.sigla || c.nome) : '—';
      badge.style.display = window._meusCursos.length ? 'inline-flex' : 'none';
    }
    aplicarVisibilidadeAnotacoes(cursoId);
  }

  // Cursos de especialização não têm nota de comportamento (sem anotações);
  // oculta as guias de anotação/fatos observados quando o curso ativo for um deles.
  function cursoAtivoTipo(cursoId) {
    const c = window._meusCursos.find(x => x.curso_id === cursoId);
    return c ? c.tipo : null;
  }

  function aplicarVisibilidadeAnotacoes(cursoId) {
    const especializacao = cursoAtivoTipo(cursoId) === 'especializacao';
    document.querySelectorAll('.cv-anot').forEach(el => el.classList.toggle('cv-hide', especializacao));
  }

  async function loadMeusCursos() {
    try {
      const res = await fetch(`${API}/matriculas/meus-cursos`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) return;
      window._meusCursos = await res.json();
      if (!window._meusCursos.length) { _aplicarCursoBadge(null); return; }
      const atual = cursoAtivoId();
      const ativo = window._meusCursos.some(c => c.curso_id === atual) ? atual : window._meusCursos[0].curso_id;
      localStorage.setItem('curso_ativo_id', ativo);
      _aplicarCursoBadge(ativo);
    } catch {
      // sem curso disponível para escolher - segue sem badge
    }
  }

  function abrirModalCurso() {
    if (!window._meusCursos.length) return;
    const ativo = cursoAtivoId();
    $('modal-curso-lista').innerHTML = window._meusCursos.map(c => `
      <button type="button" class="curso-card ${c.curso_id === ativo ? 'active' : ''}" onclick="escolherCursoAtivo(${c.curso_id})">
        <div>
          <div class="curso-card-nome">${c.sigla || c.nome}</div>
          <div class="curso-card-sub">${c.nome} · ${tipoCursoLabel(c.tipo)}${c.matricula_status === 'concluida' ? ' · Concluído' : ''}</div>
        </div>
        ${c.curso_id === ativo ? '<span class="curso-card-check">✓</span>' : ''}
      </button>
    `).join('');
    $('modal-curso').classList.add('open');
  }

  function escolherCursoAtivo(cursoId) {
    localStorage.setItem('curso_ativo_id', cursoId);
    $('modal-curso').classList.remove('open');
    location.reload();
  }

  // ── SERVER-SIDE TABLE SORT ─────────────────
  // Paginated tables only have one page of rows in the DOM, so sorting must
  // happen in the SQL query, not by reordering the visible <tr>s. table-sort.js
  // writes into this map when a `data-sort-mode="server"` header is clicked.
  window._SORT_STATE = {};
  function applySort(params, key) {
    const s = window._SORT_STATE[key];
    if (s) { params.set('order_by', s.order_by); params.set('order_dir', s.order_dir); }
  }

  function showAlert(id, msg, type = 'error') {
    const el = $(id);
    el.textContent = msg;
    el.className = `alert ${type} show`;
  }
  function hideAlert(id) { $(id).className = 'alert'; }

  function toast(msg, type = 'success') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `${type} show`;
    setTimeout(() => el.className = '', 3000);
  }

  function roleLabel(role) {
    const map = { admin: 'Admin', coordenador: 'Coordenador', auxiliar: 'Auxiliar', ensino: 'Seção de Ensino', dia_cfo: 'Dia CFO', dia_curso: 'Aluno de Dia', xerife: 'Xerife', cadete: 'Cadete', aluno: 'Aluno', comandante: 'Comandante', comandante_de_pelotao: 'Comandante de Pelotão', comandante_de_companhia: 'Comandante de Companhia', lider_corpo_alunos: 'Líder do Corpo de Alunos' };
    return map[role] || role;
  }

  function badgeHtml(role) {
    const cls = role === 'admin' ? 'badge-gold' : role === 'coordenador' ? 'badge-gold' : role === 'auxiliar' ? 'badge-gold' : role === 'ensino' ? 'badge-gold' : role === 'comandante' ? 'badge-gold' : role === 'comandante_de_pelotao' ? 'badge-gold' : role === 'comandante_de_companhia' ? 'badge-gold' : role === 'lider_corpo_alunos' ? 'badge-gold' : (role === 'dia_cfo' || role === 'dia_curso') ? 'badge-blue' : role === 'xerife' ? 'badge-green' : 'badge-silver';
    return `<span class="badge ${cls}">${roleLabel(role)}</span>`;
  }

  // Tipos de punição (resultado de veredito) - espelha schemas.ResultadoEnum.
  // PUNICAO_ROLES espelha auth_helpers.PUNICAO_ROLES (quem pode aplicar
  // qual tipo) - usado só pra filtrar opções no frontend; a validação real
  // é sempre no backend.
  const PUNICAO_LABELS = {
    justificada: 'Justificada', perda_de_ponto: 'Perda de Ponto',
    pernoite: 'Pernoite', 'licença_nao_concedida': 'Licença Não Concedida', recolher: 'Recolher',
    servico_extra: 'Serviço Extra', pre_alvorada: 'Pré-Alvorada', trabalhos_e_estudos: 'Trabalhos e Estudos',
  };
  const PUNICAO_STYLES = {
    justificada: 'color:var(--success)', perda_de_ponto: 'color:var(--danger)',
    pernoite: 'color:var(--warn)', 'licença_nao_concedida': 'color:#ed1e24', recolher: 'color:var(--blue)',
    servico_extra: 'color:var(--blue)', pre_alvorada: 'color:var(--warn)', trabalhos_e_estudos: 'color:var(--blue)',
  };
  const PUNICAO_ROLES = {
    coordenador: ['licença_nao_concedida', 'pernoite', 'recolher', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'],
    lider_corpo_alunos: ['licença_nao_concedida', 'pernoite', 'recolher', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'],
    comandante_de_companhia: ['pernoite', 'recolher', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'],
    comandante_de_pelotao: ['recolher', 'pre_alvorada', 'trabalhos_e_estudos'],
  };
  function tiposPunicaoPermitidos(role) { return PUNICAO_ROLES[role] || []; }

  // Oculta, num <select> de resultado, as opções de punição (com data de
  // cumprimento) que o role atual não pode aplicar - justificada/
  // perda_de_ponto não têm data e ficam sempre disponíveis pra quem tiver
  // acesso ao próprio select (a validação real é sempre no backend).
  function aplicarTiposPunicaoPermitidos(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const role = window._currentUser?.role;
    const permitidos = new Set(tiposPunicaoPermitidos(role));
    const semData = new Set(['', 'justificada', 'perda_de_ponto']);
    sel.querySelectorAll('option').forEach(opt => {
      opt.style.display = (semData.has(opt.value) || permitidos.has(opt.value)) ? '' : 'none';
    });
  }

  function subRoleBadgeCls(subRole) {
    return subRole === 'B1' ? 'badge-sub-b1' : subRole === 'B3' ? 'badge-sub-b3' : subRole === 'B4' ? 'badge-sub-b4' : subRole === 'B5' ? 'badge-sub-b5' : '';
  }

  function subRoleBadgeHtml(subRole) {
    if (!subRole) return '';
    return `<span class="badge ${subRoleBadgeCls(subRole)}">${subRole}</span>`;
  }

  // ── SECTIONS ──────────────────────────────────
  function toggleNavGroup(headerEl) {
    headerEl.closest('.nav-group')?.classList.toggle('collapsed');
  }

  function showSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    $(`section-${name}`).classList.add('active');
    document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
    document.querySelectorAll(`[data-section="${name}"]`).forEach(n => n.closest('.nav-group')?.classList.remove('collapsed'));

    if (name === 'usuarios')           loadUsuarios();
    if (name === 'anot-pendentes')     loadPendentes();
    if (name === 'anot-justificativa') loadJustificativa();
    if (name === 'anot-justificadas')  loadJustificadas();
    if (name === 'anot-veredito')        loadVeredito();
    if (name === 'lancamento')            initLancamento();
    if (name === 'minhas-anotacoes')      loadMinhasAnotacoes();
    if (name === 'aux-usuarios')          loadAuxUsuarios();
    if (name === 'aux-vereditos')          loadAuxVereditos();
    if (name === 'exportar')               initExportar();
    if (name === 'punicoes')               initPunicoes();
    if (name === 'pernoite-inopinado')      initPernoiteInopinado();
    if (name === 'minhas-punicoes')        initMeusPunicoes();
    if (name === 'elogios-pendentes')      loadElogiosPendentes();
    if (name === 'elogios-lista')          loadElogiosLista();
    if (name === 'lancar-elogio')          initLancarElogio();
    if (name === 'justificar')             loadJustificar();
    if (name === 'meus-vereditos')         loadMeusVereditos();
    if (name === 'meus-elogios')           loadMeusElogios();
    if (name === 'dashboard')              initDashboard();
    if (name === 'recursos')               loadRecursos();
    if (name === 'comandante-recursos')    loadComandanteRecursos();
    if (name === 'admin-coordenadores')    initAdminCoordenadores();
    if (name === 'staff-curso')            initStaffCurso();
    if (name === 'coord-turmas')           loadCoordTurmas();
    if (name === 'coord-matriculas')       loadCoordMatriculaTurmas();
    if (name === 'ensino-turmas')              loadEnsinoTurmas();
    if (name === 'ensino-matriculas')          loadEnsinoMatriculaTurmas();
    if (name === 'ensino-tipos-disciplina')    loadEnsinoTiposDisciplina();
  }

  // ── INIT LISTENERS (DOM ready) ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('btn-login').addEventListener('click', doLogin);
    $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    if (!localStorage.getItem('token')) initKeycloak();

    // Modal de termos — checkbox habilita botão de aceite
    $('chk-terms-modal').addEventListener('change', () => {
      const ok = $('chk-terms-modal').checked;
      $('btn-accept-terms').disabled = !ok;
      $('btn-accept-terms').style.opacity = ok ? '1' : '.45';
      $('btn-accept-terms').style.cursor  = ok ? 'pointer' : 'not-allowed';
    });
    $('btn-accept-terms').addEventListener('click', doAcceptTerms);
      $('btn-pw-submit').addEventListener('click', handleChangePw);
    document.getElementById('modal-anot').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-anot')) closeAnotModal();
    });
    document.getElementById('modal-edit-infracao').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-edit-infracao'))
        document.getElementById('modal-edit-infracao').classList.remove('open');
    });
    document.getElementById('edit-infracao-search').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.getElementById('sd-edit-infracao-list').querySelectorAll('.sd-option').forEach(o => {
        o.style.display = o.dataset.search.includes(q) ? '' : 'none';
      });
    });
    document.getElementById('manot-infracao-search').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.getElementById('manot-infracao-list').querySelectorAll('.sd-option').forEach(o => {
        o.style.display = o.dataset.search.includes(q) ? '' : 'none';
      });
    });
    document.getElementById('modal-edit-descr').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-edit-descr')) closeDiaCfoModal();
    });
    document.getElementById('diacfo-file-input').addEventListener('change', handleDiaCfoFileInput);
    document.getElementById('diacfo-infracao-search').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.getElementById('diacfo-infracao-list').querySelectorAll('.sd-option').forEach(o => {
        o.style.display = o.dataset.search.includes(q) ? '' : 'none';
      });
    });
    document.getElementById('modal-justificativa').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-justificativa')) closeJustModal();
    });
    document.getElementById('just-file-input').addEventListener('change', handleJustFileInput);
  });

  // ── LOGIN ──────────────────────────────────

  // ── KEYCLOAK ──────────────────────────────────
  const KEYCLOAK_CONFIG = {
    url: 'https://auth.bombeiros.pa.gov.br',
    realm: 'cbmpa',
    clientId: 'frontend-test',
  };
  let _keycloak = null;

  async function initKeycloak() {
    if (typeof Keycloak === 'undefined') {
      console.warn('[keycloak] adaptador keycloak-js não carregou.');
      return;
    }
    _keycloak = new Keycloak(KEYCLOAK_CONFIG);
    try {
      const authenticated = await _keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      });
      if (authenticated) await loginWithKeycloakToken();
    } catch (e) {
      console.error('[keycloak] falha ao inicializar', e);
    }
  }

  async function doLoginKeycloak() {
    if (!_keycloak) {
      showAlert('login-error', 'Keycloak não inicializado. Recarregue a página.');
      return;
    }
    await _keycloak.login();
  }

  async function loginWithKeycloakToken() {
    hideAlert('login-error');
    const btn = $('btn-login-keycloak');
    if (btn) { btn.classList.add('btn-loading'); btn.textContent = 'AGUARDE...'; }

    try {
      const res = await fetch(`${API}/login/keycloak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keycloak_token: _keycloak.token }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert('login-error', data.detail || 'Falha na autenticação via Keycloak.');
        return;
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('auth_provider', 'keycloak');
      await initApp();

    } catch {
      showAlert('login-error', 'Não foi possível conectar à API.');
    } finally {
      if (btn) { btn.classList.remove('btn-loading'); btn.textContent = 'ENTRAR COM KEYCLOAK'; }
    }
  }

  async function doLogin() {
    hideAlert('login-error');
    const username = $('login-username').value.trim();
    const password = $('login-password').value;

    if (!username || !password) {
      showAlert('login-error', 'Preencha todos os campos.');
      return;
    }

    const btn = $('btn-login');
    btn.classList.add('btn-loading');
    btn.textContent = 'AGUARDE...';

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert('login-error', data.detail || 'Credenciais inválidas.');
        return;
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('auth_provider', 'local');
      await initApp();

    } catch {
      showAlert('login-error', 'Não foi possível conectar à API.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.textContent = 'ENTRAR NO SISTEMA';
    }
  }

  // ── INIT APP ──────────────────────────────────
  async function initApp() {
    initDatePickers();
    try {
      // Resolve o curso ativo ANTES de buscar /me - role/sub_role/turma/pel
      // dependem de qual curso está selecionado (a mesma pessoa pode ser
      // coordenador num curso e aluno em outro).
      await loadMeusCursos();
      const res = await fetch(`${API}/me${qsCurso()}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) { doLogout(); return; }

      const u = await res.json();
      window._currentUser = u;
      window._usersMap[u.user_id] = { username: u.username, numero_geral: u.numero_geral, turma: u.turma, pel: u.pel };

      if (u.sem_vinculo) {
        $('sv-username').textContent = u.username;
        $('screen-login').classList.add('hidden');
        $('screen-sem-vinculo').classList.remove('hidden');
        $('app').classList.remove('visible');
        return;
      }
      $('screen-sem-vinculo').classList.add('hidden');

      const initial = (u.username || '?')[0].toUpperCase();

      // Topbar
      $('top-avatar').textContent = initial;
      $('top-name').textContent   = u.username;
      $('top-role').textContent   = roleLabel(u.role);

      // Perfil
      $('pf-avatar').textContent = initial;
      $('pf-name').textContent   = u.username;
      $('pf-role').textContent   = roleLabel(u.role);
      $('pf-turma-pel').textContent = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '—';
      $('pf-numero').textContent = u.numero_geral ?? '—';
      $('pf-badge').innerHTML    = badgeHtml(u.role);
      $('pf-sub-role').innerHTML = subRoleBadgeHtml(u.sub_role);
      if (u.sub_role) {
        $('pf-sub-role-row').style.display = '';
        $('pf-sub-role-value').innerHTML = subRoleBadgeHtml(u.sub_role);
      } else {
        $('pf-sub-role-row').style.display = 'none';
      }
      const btnTransferirFuncao = $('pf-btn-transferir-funcao');
      if (btnTransferirFuncao) btnTransferirFuncao.style.display = ['dia_cfo', 'dia_curso', 'xerife'].includes(u.role) ? '' : 'none';
      const btnTransferirSubFuncao = $('pf-btn-transferir-sub-funcao');
      if (btnTransferirSubFuncao) btnTransferirSubFuncao.style.display = u.sub_role ? '' : 'none';

      // Bottom nav mobile
      showMobileNav(u.role);

      // Mostrar nav de coordenador + carregar lookups
      document.body.className = document.body.className.replace(/\brole-\S+/g, '').trim();
      document.body.classList.add('role-' + u.role);

      if (u.role === 'admin') {
        $('nav-admin').style.display = 'block';
      }
      // reseta visibilidade de itens de nav-coord que podem ter ficado
      // ocultos de uma sessão anterior com outro role neste mesmo navegador
      ['recursos', 'exportar', 'dashboard', 'anot-pendentes', 'staff-curso', 'coord-turmas', 'coord-matriculas'].forEach(sec => {
        document.querySelectorAll(`#nav-coord [data-section="${sec}"]`).forEach(el => el.style.display = '');
      });
      if (u.role === 'coordenador' || u.role === 'lider_corpo_alunos') {
        // lider_corpo_alunos é semelhante ao coordenador, mas com poderes
        // sobre todo o curso (aluno, não substitui a matrícula dele) -
        // mesma visão completa de nav-coord, sem restrições - exceto staff
        // do curso, que é exclusivo do coordenador (backend só libera pra ele).
        $('nav-coord').style.display = 'block';
        loadLookups(); // carrega usuarios e transgressoes em background
        loadLookupsDiaCfo(); // carrega oficiais e cadetes para lançamento
        loadElogioTypes();
        if (u.role === 'lider_corpo_alunos') {
          ['staff-curso', 'coord-turmas', 'coord-matriculas'].forEach(sec => {
            document.querySelectorAll(`#nav-coord [data-section="${sec}"]`).forEach(el => el.style.display = 'none');
          });
        }
      }
      if (u.role === 'comandante_de_pelotao' || u.role === 'comandante_de_companhia') {
        $('nav-coord').style.display = 'block';
        loadLookups();
        loadLookupsDiaCfo();
        loadElogioTypes();
        // Recursos, Exportar, Dashboard e gestão de turmas/staff são exclusivos do coordenador.
        const ocultar = ['recursos', 'exportar', 'dashboard', 'staff-curso', 'coord-turmas', 'coord-matriculas'];
        ocultar.forEach(sec => {
          document.querySelectorAll(`#nav-coord [data-section="${sec}"]`).forEach(el => el.style.display = 'none');
        });
        // Dashboard está oculto para comandantes; esconder o header órfão de "Fatos Observados"
        const _foDiv = $('nav-coord-fo-divider'), _foLbl = $('nav-coord-fo-label');
        if (_foDiv) _foDiv.style.display = 'none';
        if (_foLbl) _foLbl.style.display = 'none';
      }
      if (u.role === 'comandante') {
        $('nav-comandante').style.display = 'block';
        loadLookups();
        loadElogioTypes();
      }
      // Mostrar nav do dia_cfo + carregar lookups necessários
      if (u.role === 'dia_cfo' || u.role === 'dia_curso' || u.role === 'xerife') {
        $('nav-diacfo').style.display = 'block';
        loadLookupsDiaCfo();
      }
      // Auxiliar
      if (u.role === 'auxiliar') {
        $('nav-auxiliar').style.display = 'block';
        loadLookups();
        loadElogioTypes();
      }
      // Ensino — pode criar turmas, matricular e gerir disciplinas/faltas em ensino.html
      if (u.role === 'ensino') {
        const navEnsino = $('nav-ensino');
        if (navEnsino) navEnsino.style.display = 'block';
      }
      // Seção compartilhada: dia_cfo/dia_curso, cadete/aluno e
      // comandante_de_pelotao que também é aluno no mesmo curso (turma != null)
      if (u.role === 'dia_cfo' || u.role === 'dia_curso' || u.role === 'xerife' || u.role === 'cadete' || u.role === 'aluno'
          || (u.role === 'comandante_de_pelotao' && u.turma != null)) {
        $('nav-shared').style.display = 'block';
        loadLookupsCadete();
      }

      loadBadges();

      // Verificar aceite dos termos antes de mostrar o app
      const termsRes = await fetch(`${API}/terms-status`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const termsData = await termsRes.json();

      $('screen-login').classList.add('hidden');
      $('app').classList.add('visible');

      if (!termsData.accepted) {
        const errEl = $('terms-modal-error');
        errEl.style.display = 'none';
        errEl.textContent = '';
        $('chk-terms-modal').checked = false;
        $('btn-accept-terms').disabled = true;
        $('btn-accept-terms').style.opacity = '.45';
        $('btn-accept-terms').style.cursor = 'not-allowed';
        $('modal-terms').classList.add('open');
      }
      if (window.innerWidth <= 640) {
        const fab = document.getElementById('fab-ordens');
        if (fab) fab.style.display = 'flex';
      }

    } catch (e) {
      console.error('[initApp]', e);
    }
  }

  // ── ACEITE DE TERMOS ──────────────────────────────────

  async function doAcceptTerms() {
    const btn = $('btn-accept-terms');
    btn.textContent = 'AGUARDE...';
    btn.disabled = true;
    btn.style.opacity = '.45';

    try {
      const res = await fetch(`${API}/terms-accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      let detail = `HTTP ${res.status}`;
      try { const d = await res.json(); detail = JSON.stringify(d); } catch {}
      if (!res.ok) throw new Error(detail);
      $('modal-terms').classList.remove('open');
      $('chk-terms-modal').checked = false;
    } catch (err) {
      const errEl = $('terms-modal-error');
      errEl.textContent = `Erro: ${err.message}`;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.style.opacity = '1';
    } finally {
      btn.textContent = 'ACEITAR E CONTINUAR';
    }
  }

  // ── LOGOUT ──────────────────────────────────
  async function handleLogout() {
    try {
      await fetch(`${API}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
    } catch {}

    const viaKeycloak = localStorage.getItem('auth_provider') === 'keycloak';
    doLogout();

    // Sessão veio do Keycloak: encerra o SSO também, senão o check-sso
    // silencioso reautentica o usuário sem pedir login de novo.
    if (viaKeycloak && _keycloak) {
      await _keycloak.logout({ redirectUri: window.location.origin + window.location.pathname });
    }
  }

  function doLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_provider');
    $('login-username').value = '';
    $('login-password').value = '';
    $('screen-login').classList.remove('hidden');
    $('screen-sem-vinculo').classList.add('hidden');
    $('app').classList.remove('visible');
    $('nav-admin').style.display = 'none';
    $('nav-coord').style.display = 'none';
    $('nav-diacfo').style.display = 'none';
    $('nav-auxiliar').style.display = 'none';
    $('nav-shared').style.display = 'none';
    document.body.className = document.body.className.replace(/\brole-\S+/g, '').trim();
    window._currentUser = null;
    window._allUsuarios = [];
    window._usersMap = {};
    window._transgMap = {};
    window._oficiaisMap = {};
    window._elogioTypesMap = {};
    // reset para perfil
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    $('section-perfil').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-section="perfil"]').classList.add('active');
  }

  // ── ALTERAR SENHA ──────────────────────────────────
  function openChangePw() {
    hideAlert('pw-error');
    hideAlert('pw-success');
    $('pw-old').value = '';
    $('pw-new').value = '';
    $('pw-confirm').value = '';
    $('modal-pw').classList.add('open');
  }
  function closePw() { $('modal-pw').classList.remove('open'); }

  async function handleChangePw() {
    hideAlert('pw-error');
    hideAlert('pw-success');

    const old_password = $('pw-old').value;
    const new_password = $('pw-new').value;
    const confirm      = $('pw-confirm').value;

    if (!old_password || !new_password || !confirm) {
      showAlert('pw-error', 'Preencha todos os campos.');
      return;
    }
    if (new_password.length < 8) {
      showAlert('pw-error', 'Mínimo 8 caracteres.');
      return;
    }
    if (new_password !== confirm) {
      showAlert('pw-error', 'As senhas não coincidem.');
      return;
    }

    const btn = $('btn-pw-submit');
    btn.classList.add('btn-loading');
    btn.textContent = 'AGUARDE...';

    try {
      const res = await fetch(`${API}/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`,
        },
        body: JSON.stringify({ old_password, new_password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert('pw-error', data.detail || 'Erro ao alterar senha.');
        return;
      }

      showAlert('pw-success', 'Senha alterada. Faça login novamente.', 'success');
      setTimeout(() => { closePw(); doLogout(); }, 1800);

    } catch {
      showAlert('pw-error', 'Erro de conexão.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.textContent = 'CONFIRMAR';
    }
  }

  // ── TRANSFERIR FUNÇÃO / SUB-FUNÇÃO (auto-serviço, mesma turma) ──────────
  // Quem tem dia_cfo/dia_curso/xerife ou uma sub-role (B3/B4/B5) pode passar
  // pra um colega da própria turma sem depender de coordenador/auxiliar -
  // ver PUT /usuarios/transferir-role e /usuarios/transferir-sub-role.
  window._transferMode = null; // 'role' | 'sub_role'

  function openTransferirFuncao() {
    window._transferMode = 'role';
    $('transferir-title').textContent = 'Transferir Função';
    $('transferir-desc').textContent = 'Informe o número geral do colega da sua turma que vai receber sua função. Depois da transferência, você volta a ser cadete/aluno normal.';
    hideAlert('transferir-error');
    hideAlert('transferir-success');
    $('transferir-numero-geral').value = '';
    $('modal-transferir').classList.add('open');
  }

  function openTransferirSubFuncao() {
    window._transferMode = 'sub_role';
    $('transferir-title').textContent = 'Transferir Sub-Função';
    $('transferir-desc').textContent = 'Informe o número geral do colega da sua turma que vai receber sua sub-função. Isso não afeta sua função atual.';
    hideAlert('transferir-error');
    hideAlert('transferir-success');
    $('transferir-numero-geral').value = '';
    $('modal-transferir').classList.add('open');
  }

  function closeTransferir() { $('modal-transferir').classList.remove('open'); }

  async function handleTransferir() {
    hideAlert('transferir-error');
    hideAlert('transferir-success');

    const numero_geral = Number($('transferir-numero-geral').value);
    if (!numero_geral) {
      showAlert('transferir-error', 'Informe um número geral válido.');
      return;
    }

    const endpoint = window._transferMode === 'sub_role'
      ? '/usuarios/transferir-sub-role'
      : '/usuarios/transferir-role';

    const btn = $('btn-transferir-submit');
    btn.classList.add('btn-loading');
    btn.textContent = 'AGUARDE...';

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ numero_geral, curso_id: cursoAtivoId() }),
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert('transferir-error', data.detail || 'Erro ao transferir.');
        return;
      }

      showAlert('transferir-success', data.message || 'Transferência realizada com sucesso.', 'success');
      toast(data.message || 'Transferência realizada com sucesso.');
      setTimeout(() => { closeTransferir(); initApp(); }, 1500);

    } catch {
      showAlert('transferir-error', 'Erro de conexão.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.textContent = 'CONFIRMAR';
    }
  }

  // ── USUÁRIOS (coordenador) ──────────────────────────────────
  window._allUsuarios  = [];
  window._usersMap     = {}; // id -> {username, numero_geral}
  window._transgMap    = {}; // id -> {descr, code, discount}
  window._oficiaisMap  = {}; // id -> {nome_de_guerra, posto}

  // ── LOOKUP HELPERS ──────────────────────────────────
  function resolveUser(id) {
    if (!id) return '—';
    const u = window._usersMap[id];
    if (!u) return `#${id}`;
    return u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
  }

  function resolveInfracao(id) {
    if (!id) return '—';
    const t = window._transgMap[id];
    if (!t) return `#${id}`;
    const pts = t.discount != null ? ` (${t.discount > 0 ? '-' : ''}${t.discount} pt)` : '';
    return `${t.code} — ${t.descr}${pts}`;
  }

  function resolveInfracaoShort(id) {
    if (!id) return '—';
    const t = window._transgMap[id];
    if (!t) return `#${id}`;
    return t.code ? `${t.code} — ${t.descr}` : t.descr;
  }

  function resolveDiscount(id) {
    if (!id) return '';
    const t = window._transgMap[id];
    if (!t || t.discount == null) return '';
    return `${t.discount > 0 ? '-' : ''}${t.discount} pt`;
  }

  function resolveOficial(id) {
    if (!id) return '—';
    const o = window._oficiaisMap[id];
    if (!o) return `#${id}`;
    return o.posto ? `${o.posto} ${o.nome_de_guerra}` : o.nome_de_guerra;
  }

  async function loadLookups() {
    try {
      const [resUsers, resTrans, resOficiais] = await Promise.all([
        fetch(`${API}/coordenador/usuarios${qsCurso()}`, { headers: { 'Authorization': `Bearer ${token()}` } }),
        fetch(`${API}/transgressoes`,        { headers: { 'Authorization': `Bearer ${token()}` } }),
        fetch(`${API}/oficiais-de-dia`,      { headers: { 'Authorization': `Bearer ${token()}` } }),
      ]);
      if (resUsers.ok) {
        const users = await resUsers.json();
        window._allUsuarios = users;
        window._usersMap = {};
        users.forEach(u => { window._usersMap[u.id] = { username: u.username, numero_geral: u.numero_geral, turma: u.turma, pel: u.pel }; });
        populatePelLancamento();
        // Merge staff (coordenadores, auxiliares, comandantes) so cad_resp resolves
        try {
          const resStaff = await fetch(`${API}/coordenador/staff${qsCurso()}`, { headers: { 'Authorization': `Bearer ${token()}` } });
          if (resStaff.ok) {
            const staff = await resStaff.json();
            staff.forEach(s => { if (!window._usersMap[s.user_id]) window._usersMap[s.user_id] = { username: s.username, numero_geral: null, turma: null, pel: s.pel }; });
          }
        } catch {}
        // Always ensure current user is resolvable
        const cu = window._currentUser;
        if (cu) window._usersMap[cu.user_id] = { username: cu.username, numero_geral: cu.numero_geral, turma: cu.turma, pel: cu.pel };
      }
      if (resTrans.ok) {
        const trans = await resTrans.json();
        window._transgMap = {};
        trans.forEach(t => { window._transgMap[t.id] = { descr: t.descr, code: t.code, discount: t.discount }; });
      }
      if (resOficiais.ok) {
        const oficiais = await resOficiais.json();
        window._oficiaisMap = {};
        oficiais.forEach(o => { window._oficiaisMap[o.id] = { nome_de_guerra: o.nome_de_guerra, posto: o.posto }; });
      }
      // Populate searchable dropdowns now that data is ready
      populateCadeteSds();
      if (!window._auxUsuarios || window._auxUsuarios.length === 0) {
        window._auxUsuarios = window._allUsuarios;
      }
      populateAuxCadeteSd();
      populateInfracaoSds();
    } catch {}
  }

  async function loadUsuarios() {
    $('usuarios-container').innerHTML = `
      <div class="card">
        <table><tbody class="loading-row">
          <tr><td>CARREGANDO...</td></tr>
        </tbody></table>
      </div>`;

    try {
      const res = await fetch(`${API}/coordenador/usuarios${qsCurso()}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });

      if (!res.ok) {
        $('usuarios-container').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-text">ERRO AO CARREGAR USUÁRIOS</div></div>`;
        return;
      }

      window._allUsuarios = await res.json();
      window._usersMap = {};
      window._allUsuarios.forEach(u => { window._usersMap[u.id] = { username: u.username, numero_geral: u.numero_geral, turma: u.turma, pel: u.pel }; });
      populatePelLancamento();
      renderUsuarios();

    } catch {
      $('usuarios-container').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-text">FALHA NA CONEXÃO COM A API</div></div>`;
    }
  }

  function renderUsuarios() {
    const filterNome = $('filter-nome')?.value?.toLowerCase() ?? '';
    const filterRole = $('filter-role')?.value ?? '';

    const filterTurmaPel = $('filter-turma-pel')?.value ?? '';

    let lista = window._allUsuarios.filter(u => {
      const nomeOk = !filterNome || u.username.toLowerCase().includes(filterNome);
      const roleOk = !filterRole || u.role === filterRole;
      const tpKey  = u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : '';
      const tpOk   = !filterTurmaPel || tpKey === filterTurmaPel;
      return nomeOk && roleOk && tpOk;
    });

    // Populate turma+pel select if empty
    const tpSelect = $('filter-turma-pel');
    if (tpSelect && tpSelect.options.length <= 1) {
      const keys = [...new Set(window._allUsuarios.map(u =>
        u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : null
      ).filter(Boolean))].sort((a, b) => {
        const [ta, pa=''] = a.split('-'), [tb, pb=''] = b.split('-');
        return (parseInt(ta)||9999) - (parseInt(tb)||9999) || pa.localeCompare(pb);
      });
      keys.forEach(k => {
        const [t, p] = k.split('-');
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${t}${p ?? ''}`;
        tpSelect.appendChild(opt);
      });
    }

    $('usuarios-meta').textContent = `${lista.length} usuário(s) exibido(s) de ${window._allUsuarios.length} total`;

    if (!lista.length) {
      $('usuarios-container').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◎</div>
          <div class="empty-state-text">NENHUM USUÁRIO ENCONTRADO</div>
        </div>`;
      return;
    }

    $('usuarios-container').innerHTML = renderGruposUsuarios(lista, (u) => renderUsuarioRow(u, 'coord'));
  }

  // ── SHARED: renderiza grupos por turma+pel ──────────────────
  function renderGruposUsuarios(lista, rowFn) {
    const byGrupo = {};
    lista.forEach(u => {
      const key = `${u.turma ?? '?'}__${u.pel ?? ''}`;
      if (!byGrupo[key]) byGrupo[key] = [];
      byGrupo[key].push(u);
    });

    const grupos = Object.keys(byGrupo).sort((a, b) => {
      const [ta, pa] = a.split('__'), [tb, pb] = b.split('__');
      const nt = (parseInt(ta)||9999) - (parseInt(tb)||9999);
      return nt !== 0 ? nt : (pa||'').localeCompare(pb||'');
    });

    return grupos.map(key => {
      const [turma, pel] = key.split('__');
      const cadetes = byGrupo[key].sort((a, b) => {
        const na = a.numero_geral ?? Infinity, nb = b.numero_geral ?? Infinity;
        return na !== nb ? na - nb : a.username.localeCompare(b.username);
      });
      return `
        <div class="turma-group">
          <div class="turma-header">
            <span class="turma-badge">${turma}${pel ?? ''}</span>
            <span class="turma-count">${cadetes.length} integrante(s)</span>
          </div>
          <div class="card" style="margin-bottom:0;border-top:none;">
            <div class="table-wrap">
              <table class="sortable-table">
                <thead>
                  <tr>
                    <th>Nº Geral</th>
                    <th>Nome de Guerra</th>
                    <th>Pel</th>
                    <th>Função Atual</th>
                    <th>Alterar Função</th>
                    <th>Alterar Sub-Função</th>
                  </tr>
                </thead>
                <tbody>${cadetes.map(u => rowFn(u)).join('')}</tbody>
              </table>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── SHARED: renderiza linha de usuário ──────────────────
  const _STAFF_ROLES = new Set(['auxiliar', 'ensino', 'lider_corpo_alunos', 'comandante_de_pelotao', 'comandante_de_companhia']);
  function renderUsuarioRow(u, ctx) {
    const numGeral = u.numero_geral ?? '—';
    const isStaff = _STAFF_ROLES.has(u.role);
    const isCommandante = u.role === 'comandante_de_pelotao' || u.role === 'comandante_de_companhia';
    const badgeCls = isStaff ? 'badge-gold' : (u.role === 'dia_cfo' || u.role === 'dia_curso') ? 'badge-blue' : u.role === 'xerife' ? 'badge-green' : 'badge-silver';
    const selectId = ctx === 'aux' ? `aux-role-select-${u.id}` : `role-select-${u.id}`;
    const statusId = ctx === 'aux' ? `aux-role-status-${u.id}` : `role-status-${u.id}`;
    const onChange = ctx === 'aux'
      ? `auxConfirmChangeRole(${u.id}, '${u.username}', this.value, this)`
      : `confirmChangeRole(${u.id}, '${u.username}', this.value, this)`;
    const subRoleSelectId = ctx === 'aux' ? `aux-sub-role-select-${u.id}` : `sub-role-select-${u.id}`;
    const subRoleStatusId = ctx === 'aux' ? `aux-sub-role-status-${u.id}` : `sub-role-status-${u.id}`;
    const onSubRoleChange = ctx === 'aux'
      ? `auxConfirmChangeSubRole(${u.id}, '${u.username}', this.value, this)`
      : `confirmChangeSubRole(${u.id}, '${u.username}', this.value, this)`;
    const subRoleVal = u.sub_role ?? '';
    const roleSelectHtml = isStaff
      ? `<select class="role-select" disabled><option selected>${roleLabel(u.role)}</option></select>`
      : `<select class="role-select" id="${selectId}" onchange="${onChange}">
              <option value="cadete"    ${u.role==='cadete'   ?'selected':''}>Cadete</option>
              <option value="aluno"     ${u.role==='aluno'    ?'selected':''}>Aluno</option>
              <option value="dia_cfo"   ${u.role==='dia_cfo'  ?'selected':''}>Dia CFO</option>
              <option value="dia_curso" ${u.role==='dia_curso'?'selected':''}>Aluno de Dia</option>
              <option value="xerife"    ${u.role==='xerife'   ?'selected':''}>Xerife</option>
            </select>`;
    return `
      <tr>
        <td class="td-mono">${numGeral}</td>
        <td class="td-name">${u.username}</td>
        <td class="td-mono">${u.pel ?? '—'}</td>
        <td><span class="badge ${badgeCls}">${roleLabel(u.role)}${isCommandante && u.cmd_turmas ? ` · T${u.cmd_turmas}` : ''}</span> ${subRoleBadgeHtml(u.sub_role)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            ${roleSelectHtml}
            <span class="td-mono" id="${statusId}" style="font-size:10px;width:52px;display:inline-block;flex-shrink:0;"></span>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <select class="role-select" id="${subRoleSelectId}" onchange="${onSubRoleChange}">
              <option value=""   ${subRoleVal===''  ?'selected':''}>—</option>
              <option value="B1" ${subRoleVal==='B1'?'selected':''}>B1</option>
              <option value="B3" ${subRoleVal==='B3'?'selected':''}>B3</option>
              <option value="B4" ${subRoleVal==='B4'?'selected':''}>B4</option>
              <option value="B5" ${subRoleVal==='B5'?'selected':''}>B5</option>
            </select>
            <span class="td-mono" id="${subRoleStatusId}" style="font-size:10px;width:52px;display:inline-block;flex-shrink:0;"></span>
          </div>
        </td>
      </tr>`;
  }

  async function confirmChangeRole(userId, username, newRole, selectEl) {
    const usuario = window._allUsuarios.find(u => u.id === userId);
    if (!usuario || usuario.role === newRole) return;
    const statusEl = $(`role-status-${userId}`);
    statusEl.textContent = 'salvando...';
    statusEl.style.color = 'var(--muted)';
    selectEl.disabled = true;
    try {
      const res = await fetch(`${API}/coordenador/usuarios/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ numero_geral: usuario.numero_geral, new_role: newRole, curso_id: cursoAtivoId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        selectEl.value = usuario.role;
        statusEl.textContent = '✗ erro';
        statusEl.style.color = 'var(--danger)';
        toast(data.detail || 'Erro ao alterar função.', 'error');
      } else {
        usuario.role = newRole;
        statusEl.textContent = '✓ salvo';
        statusEl.style.color = 'var(--success)';
        toast(`Função de ${username} alterada para ${roleLabel(newRole)}.`);
        setTimeout(() => { statusEl.textContent = ''; renderUsuarios(); }, 1500);
      }
    } catch {
      selectEl.value = usuario.role;
      statusEl.textContent = '✗ falha';
      statusEl.style.color = 'var(--danger)';
      toast('Erro de conexão.', 'error');
    } finally {
      selectEl.disabled = false;
    }
  }

  async function confirmChangeSubRole(userId, username, newSubRole, selectEl) {
    const usuario = window._allUsuarios.find(u => u.id === userId);
    if (!usuario || (usuario.sub_role ?? '') === newSubRole) return;
    const statusEl = $(`sub-role-status-${userId}`);
    statusEl.textContent = 'salvando...';
    statusEl.style.color = 'var(--muted)';
    selectEl.disabled = true;
    try {
      const res = await fetch(`${API}/coordenador/usuarios/sub_role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ numero_geral: usuario.numero_geral, new_sub_role: newSubRole || null, curso_id: cursoAtivoId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        selectEl.value = usuario.sub_role ?? '';
        statusEl.textContent = '✗ erro';
        statusEl.style.color = 'var(--danger)';
        toast(data.detail || 'Erro ao alterar sub-função.', 'error');
      } else {
        usuario.sub_role = newSubRole || null;
        statusEl.textContent = '✓ salvo';
        statusEl.style.color = 'var(--success)';
        toast(`Sub-função de ${username} alterada para ${newSubRole || '—'}.`);
        setTimeout(() => { statusEl.textContent = ''; renderUsuarios(); }, 1500);
      }
    } catch {
      selectEl.value = usuario.sub_role ?? '';
      statusEl.textContent = '✗ falha';
      statusEl.style.color = 'var(--danger)';
      toast('Erro de conexão.', 'error');
    } finally {
      selectEl.disabled = false;
    }
  }



  // ══════════════════════════════════════════════════
  // SEARCHABLE DROPDOWN ENGINE
  // ══════════════════════════════════════════════════
  // Each dropdown stores its selected value on the wrap element as ._value
  // Options are rendered once on first open (or after loadLookups)

  function toggleSd(id) {
    const panel = document.getElementById(id + '-panel');
    const isOpen = panel.classList.contains('open');
    // Close all others
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) {
      panel.classList.add('open');
      const search = panel.querySelector('.sd-search');
      if (search) { search.value = ''; filterSd(id, ''); search.focus(); }
    }
  }

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.sd-wrap')) {
      document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    }
  });

  function filterSd(id, query) {
    const list = document.getElementById(id + '-list');
    if (!list) return;
    const q = query.toLowerCase();
    list.querySelectorAll('.sd-option').forEach(opt => {
      opt.style.display = opt.dataset.search.includes(q) ? '' : 'none';
    });
  }

  function clearSd(id, loadFn) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap._value = null;
    const trigger = document.getElementById(id + '-trigger');
    if (trigger) trigger.textContent = trigger.dataset.placeholder || 'Todos os cadetes';
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    loadFn(1);
  }

  function selectSdOption(id, value, label, loadFn) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap._value = value;
    const trigger = document.getElementById(id + '-trigger');
    if (trigger) trigger.textContent = label;
    // Mark selected
    const list = document.getElementById(id + '-list');
    if (list) list.querySelectorAll('.sd-option').forEach(o => {
      o.classList.toggle('sd-selected', o.dataset.value === String(value));
    });
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    loadFn(1);
  }

  function getSdValue(id) {
    const wrap = document.getElementById(id);
    return wrap ? (wrap._value ?? null) : null;
  }

  // Populate cadete dropdowns for all sections
  function populateCadeteSds() {
    const sections = ['pendentes', 'justificativa', 'justificadas', 'veredito'];
    const loadFns  = [loadPendentes, loadJustificativa, loadJustificadas, loadVeredito];

    // Populate punições cadete filter separately (different reload fn)
    const punListEl = document.getElementById('sd-pun-cadete-list');
    if (punListEl) {
      punListEl.innerHTML = window._allUsuarios.map(u => {
        const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
        return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
          onclick="selectSdOption('sd-pun-cadete', ${u.id}, '${label.replace(/'/g,"\\'")}', () => { loadPunCalendario(); loadPunicoesList(); })">
          <span class="sd-option-label">${label}</span>
        </div>`;
      }).join('');
    }

    sections.forEach((sec, i) => {
      const listEl = document.getElementById(`sd-cadete-${sec}-list`);
      const trigEl = document.getElementById(`sd-cadete-${sec}-trigger`);
      if (!listEl) return;
      if (trigEl) trigEl.dataset.placeholder = 'Todos os cadetes';
      listEl.innerHTML = window._allUsuarios.map(u => {
        const label  = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
        const tpKey  = u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : '';
        const tpLbl  = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
        return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}" data-tp="${tpKey}"
          onclick="selectSdOption('sd-cadete-${sec}', ${u.id}, '${label.replace(/'/g, String.fromCharCode(39))}', ${loadFns[i].name})">
          <span class="sd-option-label">${label}</span>
          <span class="sd-option-pts" style="color:var(--muted);">${tpLbl}</span>
        </div>`;
      }).join('');

      // Populate and wire tp-filter select
      const tpSel = document.getElementById(`tp-filter-${sec}`);
      if (tpSel && tpSel.options.length <= 1) {
        const keys = [...new Set(window._allUsuarios.map(u =>
          u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : null
        ).filter(Boolean))].sort((a, b) => {
          const [ta, pa=''] = a.split('-'), [tb, pb=''] = b.split('-');
          return (parseInt(ta)||9999) - (parseInt(tb)||9999) || pa.localeCompare(pb);
        });
        keys.forEach(k => {
          const [t, p] = k.split('-');
          const opt = document.createElement('option');
          opt.value = k; opt.textContent = `${t}${p ?? ''}`;
          tpSel.appendChild(opt);
        });
        tpSel.addEventListener('change', () => {
          const val = tpSel.value;
          listEl.querySelectorAll('.sd-option').forEach(o => {
            o.style.display = !val || o.dataset.tp === val ? '' : 'none';
          });
          // Clear cadete selection if it was from a different group
          const wrap = document.getElementById(`sd-cadete-${sec}`);
          if (wrap && wrap._value) {
            const u2 = window._allUsuarios.find(u => u.id === wrap._value);
            const k2 = u2 ? `${u2.turma}${u2.pel ? '-'+u2.pel : ''}` : '';
            if (val && k2 !== val) clearSd(`sd-cadete-${sec}`, loadFns[i]);
            else loadFns[i](1);
          } else {
            loadFns[i](1);
          }
        });
      }
    });

    // Dia CFO/Xerife filter for justificadas
    const respJustList = document.getElementById('sd-resp-justificadas-list');
    const respJustTrig = document.getElementById('sd-resp-justificadas-trigger');
    if (respJustList) {
      if (respJustTrig) respJustTrig.dataset.placeholder = 'Todos';
      respJustList.innerHTML = window._allUsuarios
        .slice()
        .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999) || a.username.localeCompare(b.username))
        .map(u => {
          const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
          const roleSuffix = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
          return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
            onclick="selectSdOption('sd-resp-justificadas', ${u.id}, '${label.replace(/'/g, String.fromCharCode(39))}', loadJustificadas)">
            <span class="sd-option-label" style="flex:1;">${label}</span><span style="font-size:10px;color:var(--muted);flex-shrink:0;">${roleSuffix}</span>
          </div>`;
        }).join('') || '<div class="sd-option" style="color:var(--muted);cursor:default;">Nenhum usuário</div>';
    }

    // Dia CFO filter for pendentes — todos os usuários (qualquer um pode ter lançado)
    const diaCfoList = document.getElementById('sd-diacfo-pendentes-list');
    const diaCfoTrig = document.getElementById('sd-diacfo-pendentes-trigger');
    if (diaCfoList) {
      if (diaCfoTrig) diaCfoTrig.dataset.placeholder = 'Todos';
      diaCfoList.innerHTML = window._allUsuarios
        .slice()
        .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999) || a.username.localeCompare(b.username))
        .map(u => {
          const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
          const roleSuffix = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
          return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
            onclick="selectSdOption('sd-diacfo-pendentes', ${u.id}, '${label.replace(/'/g, String.fromCharCode(92,39))}', loadPendentes)">
            <span class="sd-option-label" style="flex:1;">${label}</span><span style="font-size:10px;color:var(--muted);flex-shrink:0;">${roleSuffix}</span>
          </div>`;
        }).join('') || '<div class="sd-option" style="color:var(--muted);cursor:default;">Nenhum usuário</div>';
    }

    // Cadete filter for elogios-pendentes and elogios-lista
    [['sd-cadete-elogios-pend', loadElogiosPendentes], ['sd-cadete-elogios-lista', loadElogiosLista]].forEach(([sdId, loadFn]) => {
      const listEl = document.getElementById(`${sdId}-list`);
      const trigEl = document.getElementById(`${sdId}-trigger`);
      if (!listEl) return;
      if (trigEl) trigEl.dataset.placeholder = 'Todos os cadetes';
      listEl.innerHTML = window._allUsuarios
        .slice()
        .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999) || a.username.localeCompare(b.username))
        .map(u => {
          const label      = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
          const turmaLabel = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
          return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
            onclick="selectSdOption('${sdId}', ${u.id}, '${label.replace(/'/g, String.fromCharCode(92,39))}', ${loadFn.name})">
            <span class="sd-option-label" style="flex:1;">${label}</span>
            <span style="font-size:10px;color:var(--muted);flex-shrink:0;">${turmaLabel}</span>
          </div>`;
        }).join('') || '<div class="sd-option" style="color:var(--muted);cursor:default;">Nenhum usuário</div>';
    });
  }

  // Populate infração dropdowns for pendentes, justificativa and justificadas
  function populateInfracaoSds() {
    const sections = ['pendentes', 'justificativa', 'justificadas', 'veredito'];
    const loadFns  = [loadPendentes, loadJustificativa, loadJustificadas, loadVeredito];
    sections.forEach((sec, i) => {
      const listEl = document.getElementById(`sd-infracao-${sec}-list`);
      const trigEl = document.getElementById(`sd-infracao-${sec}-trigger`);
      if (!listEl) return;
      if (trigEl) trigEl.dataset.placeholder = 'Todas as infrações';
      const trans = Object.entries(window._transgMap);
      listEl.innerHTML = trans.map(([id, t]) => {
        const label = t.code ? `${t.code} — ${t.descr}` : t.descr;
        const pts   = t.discount != null ? `${t.discount > 0 ? '-' : ''}${t.discount} pt` : '';
        return `<div class="sd-option" data-value="${id}" data-search="${label.toLowerCase()}"
          onclick="selectSdOption('sd-infracao-${sec}', ${id}, '${(t.code || t.descr).replace(/'/g,"\\'")}', ${loadFns[i].name})">
          <span class="sd-option-label">${label}</span>
          <span class="sd-option-pts">${pts}</span>
        </div>`;
      }).join('');
    });
  }

  // ══════════════════════════════════════════════════
  // EDITAR INFRAÇÃO INLINE
  // ══════════════════════════════════════════════════
  let _editAnotId  = null;
  let _editContext = null;

  function openEditInfracao(anotId, currentInfrId, context) {
    _editAnotId  = anotId;
    _editContext = context;

    // Populate the list
    const listEl = document.getElementById('sd-edit-infracao-list');
    const trans  = Object.entries(window._transgMap);
    listEl.innerHTML = trans.map(([id, t]) => {
      const label = t.code ? `${t.code} — ${t.descr}` : t.descr;
      const pts   = t.discount != null ? `${t.discount > 0 ? '-' : ''}${t.discount} pt` : '';
      const sel   = Number(id) === Number(currentInfrId) ? 'sd-selected' : '';
      return `<div class="sd-option ${sel}" data-value="${id}" data-search="${label.toLowerCase()}"
        onclick="pickEditInfracao(${id})">
        <span class="sd-option-label">${label}</span>
        <span class="sd-option-pts">${pts}</span>
      </div>`;
    }).join('');

    document.getElementById('edit-infracao-search').value = '';
    document.getElementById('edit-infracao-error').className = 'alert error';
    document.getElementById('modal-edit-infracao').classList.add('open');
  }

  async function pickEditInfracao(newInfracaoId) {
    if (!_editAnotId) return;
    const errEl = document.getElementById('edit-infracao-error');
    errEl.className = 'alert error';

    try {
      const res = await fetch(`${API}/anotacoes/${_editAnotId}/infracao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ infracao: newInfracaoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.detail || 'Erro ao alterar infração.';
        errEl.className = 'alert error show';
        return;
      }
      const t = window._transgMap[newInfracaoId];
      const label = t ? (t.code ? `${t.code} — ${t.descr}` : t.descr) : `#${newInfracaoId}`;
      toast(`Infração da anotação #${_editAnotId} alterada para: ${label}`);
      document.getElementById('modal-edit-infracao').classList.remove('open');

      if (_editContext === 'pendentes')    loadPendentes(ANOT_STATE.pendentes.page);
      if (_editContext === 'justificativa') loadJustificativa(ANOT_STATE.justificativa.page);
    } catch {
      errEl.textContent = 'Erro de conexão.';
      errEl.className = 'alert error show';
    }
  }


  // ── ANOTAÇÕES — estado ──────────────────────────────────
  const ANOT_STATE = {
    pendentes:     { page: 1, total: 0, data: [] },
    justificativa: { page: 1, total: 0, data: [] },
    justificadas:  { page: 1, total: 0, data: [] },
    veredito:      { page: 1, total: 0, data: [] },
  };
  let LIMIT = 20;

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }

  function fmtDateOnly(iso) {
    if (!iso) return '—';
    const str = String(iso);
    if (str.length === 10) {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    }
    // String com hora/timezone: usa data UTC para não deslocar por fuso
    const dt = new Date(str);
    if (isNaN(dt)) return '—';
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  function horasResposta(approved_at, enviado_em) {
    if (!approved_at || !enviado_em) return '—';
    const ms = new Date(enviado_em) - new Date(approved_at);
    if (isNaN(ms) || ms < 0) return '—';
    const h = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    const cor = h > 48 ? 'var(--danger)' : h > 24 ? 'var(--warn)' : 'var(--success)';
    return `<span style="font-family:'IBM Plex Mono',monospace;color:${cor};">${h}h${min > 0 ? ` ${min}min` : ''}</span>`;
  }

  function renderPagBar(containerId, infoId, state, loadFn) {
    const totalPages = Math.ceil(state.total / LIMIT) || 1;
    const $info = document.getElementById(infoId);
    const $btns = document.getElementById(containerId);
    if ($info) $info.textContent = `${state.data.length} de ${state.total} registro(s) · pág. ${state.page}/${totalPages}`;
    if (!$btns) return;
    let html = '';
    // Limit selector
    html += `<div style="display:flex;align-items:center;gap:4px;margin-right:8px;">` +
      `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--muted);letter-spacing:1px;">por pág.</span>` +
      [20,50,100].map(n =>
        `<div class="pag-btn${LIMIT===n?' pag-active':''}" style="min-width:32px;text-align:center;" onclick="setLimit(${n},${loadFn.name || 'loadFn'})">${n}</div>`
      ).join('') +
      `</div>`;
    html += `<div class="pag-btn" onclick="(${loadFn.name || 'loadFn'})(${state.page - 1})" ${state.page <= 1 ? 'style="opacity:.3;pointer-events:none;"' : ''}>‹</div>`;
    // show up to 5 page buttons
    const start = Math.max(1, state.page - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      html += `<div class="pag-btn ${p === state.page ? 'pag-active' : ''}" onclick="(${loadFn.name || 'loadFn'})(${p})">${p}</div>`;
    }
    html += `<div class="pag-btn" onclick="(${loadFn.name || 'loadFn'})(${state.page + 1})" ${state.page >= totalPages ? 'style="opacity:.3;pointer-events:none;"' : ''}>›</div>`;
    $btns.innerHTML = html;
  }

  function setLimit(n, fnName) {
    LIMIT = n;
    if (typeof fnName === 'function') fnName(1);
    else if (typeof window[fnName] === 'function') window[fnName](1);
  }

  // ── BADGES — carrega contadores da sidebar ao abrir o site ──────
  async function loadBadges() {
    try {
      const res = await fetch(`${API}/notificacoes${qsCurso()}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const d = await res.json();

      function setBadge(id, n) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = n;
        el.style.display = n > 0 ? 'inline-block' : 'none';
      }

      if (d.pendentes !== undefined) {
        setBadge('badge-pendentes',     d.pendentes);
        setBadge('badge-pendentes-aux', d.pendentes);
      }
      if (d.aguardando_justificativa !== undefined) {
        setBadge('badge-justificativa',     d.aguardando_justificativa);
        setBadge('badge-justificativa-aux', d.aguardando_justificativa);
      }
      if (d.elogios_pendentes !== undefined) {
        setBadge('badge-elogios-pend',     d.elogios_pendentes);
        setBadge('badge-elogios-pend-aux', d.elogios_pendentes);
      }
      if (d.justificar !== undefined) {
        setBadge('badge-justificar', d.justificar);
      }
      if (d.recursos_pendentes !== undefined) {
        setBadge('badge-recursos-pend', d.recursos_pendentes);
        setBadge('badge-recursos-cmd',  d.recursos_pendentes);
      }
    } catch {}
  }

  // ── PENDENTES ──────────────────────────────────
  async function loadPendentes(page = 1) {
    const tbody = document.getElementById('tbody-pendentes');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">CARREGANDO...</td></tr>';
    clearSelectionPendentes();

    try {
      const cadeteIdP  = getSdValue('sd-cadete-pendentes');
      const diaCfoIdP   = getSdValue('sd-diacfo-pendentes');
      const tpPRaw = document.getElementById('tp-filter-pendentes')?.value ?? '';
      const [tpPTurma, tpPPel] = tpPRaw ? tpPRaw.split('-') : ['', ''];
      const infracaoP = getSdValue('sd-infracao-pendentes');
      const params_p = new URLSearchParams({ status: 'pendente', page, limit: LIMIT });
      if (cadeteIdP)  params_p.set('cadete_id', cadeteIdP);
      if (diaCfoIdP)  params_p.set('cad_resp',  diaCfoIdP);
      if (infracaoP)  params_p.set('infracao',  infracaoP);
      if (tpPTurma)   params_p.set('turma',     tpPTurma);
      if (tpPPel)     params_p.set('pel',        tpPPel);
      if (cursoAtivoId() != null) params_p.set('curso_id', cursoAtivoId());
      applySort(params_p, 'pendentes');
      const urlP = `${API}/coordenador/anotacoes?${params_p}`;
      const res = await fetch(urlP, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      ANOT_STATE.pendentes = { page, total: json.total, data: json.data };

      // Atualizar badge na sidebar
      const badge = document.getElementById('badge-pendentes');
      if (badge) {
        badge.textContent = json.total;
        badge.style.display = json.total > 0 ? 'inline-block' : 'none';
      }
      const badgeAux = document.getElementById('badge-pendentes-aux');
      if (badgeAux) {
        badgeAux.textContent = json.total;
        badgeAux.style.display = json.total > 0 ? 'inline-block' : 'none';
      }

      document.getElementById('meta-pendentes').textContent =
        `${json.total} anotação(ões) aguardando aprovação`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO PENDENTE</td></tr>';
        document.getElementById('pag-info-pendentes').textContent = '0 registros';
        document.getElementById('pag-btns-pendentes').innerHTML = '';
        return;
      }

      tbody.innerHTML = json.data.map(a => `
        <tr style="cursor:pointer;" id="pend-row-${a.id}" onclick="openAnotModal(${a.id}, 'pendente')">
          <td class="cb-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="cb-row cb-pend" value="${a.id}"
              onchange="onPendCheckChange()" />
          </td>
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${resolveOficial(a.of_resp)}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td class="td-mono">${resolveUser(a.cad_resp)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${a.descricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${a.descricao ?? '<span style="color:var(--muted);font-style:italic;font-size:11px;">sem descrição</span>'}</td>
        </tr>`).join('');

      renderPagBar('pag-btns-pendentes', 'pag-info-pendentes', ANOT_STATE.pendentes, loadPendentes);

    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }


  // ── AGUARDANDO JUSTIFICATIVA ──────────────────────────────────
  async function loadJustificativa(page = 1) {
    const tbody = document.getElementById('tbody-justificativa');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="7">CARREGANDO...</td></tr>';

    try {
      const cadeteIdJ = getSdValue('sd-cadete-justificativa');
      const tpJRaw = document.getElementById('tp-filter-justificativa')?.value ?? '';
      const [tpJTurma, tpJPel] = tpJRaw ? tpJRaw.split('-') : ['', ''];
      const infracaoJ = getSdValue('sd-infracao-justificativa');
      const paramsJ = new URLSearchParams({ status: 'aprovada', justificativa: 'nao_respondida', page, limit: LIMIT });
      if (cadeteIdJ)  paramsJ.set('cadete_id', cadeteIdJ);
      if (infracaoJ)  paramsJ.set('infracao',  infracaoJ);
      if (tpJTurma)   paramsJ.set('turma',     tpJTurma);
      if (tpJPel)     paramsJ.set('pel',        tpJPel);
      if (cursoAtivoId() != null) paramsJ.set('curso_id', cursoAtivoId());
      applySort(paramsJ, 'justificativa');
      const res = await fetch(`${API}/coordenador/anotacoes?${paramsJ}`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      );
      if (!res.ok) throw new Error();
      const json = await res.json();

      ANOT_STATE.justificativa = { page, total: json.total, data: json.data };

      const badgeJustAux = document.getElementById('badge-justificativa-aux');
      const badge = document.getElementById('badge-justificativa');
      if (badge) {
        badge.textContent = json.total;
        badge.style.display = json.total > 0 ? 'inline-block' : 'none';
      }
      if (badgeJustAux) {
        badgeJustAux.textContent = json.total;
        badgeJustAux.style.display = json.total > 0 ? 'inline-block' : 'none';
      }

      document.getElementById('meta-justificativa').textContent =
        `${json.total} anotação(ões) aprovadas aguardando justificativa`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO NESTE ESTADO</td></tr>';
        document.getElementById('pag-info-justificativa').textContent = '0 registros';
        document.getElementById('pag-btns-justificativa').innerHTML = '';
        return;
      }

      tbody.innerHTML = json.data.map(a => {
        const temRascunho = a.justificativa !== null && !a.justificativa_enviada;
        const horas = a.horas_desde_aprovacao != null ? Math.floor(Number(a.horas_desde_aprovacao)) : null;
        const vencido = horas != null && horas > 48;
        const prazoLabel = horas != null
          ? (vencido
              ? `<span style="color:var(--danger);font-weight:700;">+${horas}h ⚑ VENCIDO</span>`
              : `<span style="color:var(--success);">${horas}h / 48h</span>`)
          : '—';
        return `
        <tr style="cursor:pointer;${vencido ? 'border-left:3px solid var(--danger);' : ''}" onclick="openAnotModal(${a.id}, 'justificativa')">
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${fmtDate(a.approved_at)}</td>
          <td class="td-mono">${prazoLabel}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${a.descricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td>${temRascunho
            ? '<span class="pill" style="color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);">Rascunho salvo</span>'
            : '<span class="pill" style="color:var(--muted);border-color:var(--border);">Sem rascunho</span>'
          }</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-justificativa', 'pag-info-justificativa', ANOT_STATE.justificativa, loadJustificativa);

    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  // ── JUSTIFICADAS ──────────────────────────────────
  async function loadJustificadas(page = 1) {
    const tbody = document.getElementById('tbody-justificadas');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">CARREGANDO...</td></tr>';

    try {
      const cadeteIdJd  = getSdValue('sd-cadete-justificadas');
      const respIdJd    = getSdValue('sd-resp-justificadas');
      const infracaoJd  = getSdValue('sd-infracao-justificadas');
      const dataFatoJd  = document.getElementById('filter-just-data-fato')?.value || '';
      const tpJdRaw = document.getElementById('tp-filter-justificadas')?.value ?? '';
      const [tpJdTurma, tpJdPel] = tpJdRaw ? tpJdRaw.split('-') : ['', ''];
      const paramsJd = new URLSearchParams({ justificativa: 'respondida', veredito_status: 'pendente', page, limit: LIMIT });
      if (cadeteIdJd) paramsJd.set('cadete_id', cadeteIdJd);
      if (respIdJd)   paramsJd.set('cad_resp',  respIdJd);
      if (infracaoJd) paramsJd.set('infracao',  infracaoJd);
      if (dataFatoJd) paramsJd.set('data_fato', dataFatoJd);
      if (tpJdTurma)  paramsJd.set('turma',     tpJdTurma);
      if (tpJdPel)    paramsJd.set('pel',        tpJdPel);
      if (cursoAtivoId() != null) paramsJd.set('curso_id', cursoAtivoId());
      applySort(paramsJd, 'justificadas');
      const res = await fetch(`${API}/coordenador/anotacoes?${paramsJd}`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      );
      if (!res.ok) throw new Error();
      const json = await res.json();

      ANOT_STATE.justificadas = { page, total: json.total, data: json.data };

      document.getElementById('meta-justificadas').textContent =
        `${json.total} anotação(ões) com justificativa enviada — aguardando veredito`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO NESTE ESTADO</td></tr>';
        document.getElementById('pag-info-justificadas').textContent = '0 registros';
        document.getElementById('pag-btns-justificadas').innerHTML = '';
        return;
      }

      window._justificadasData = json.data;
      tbody.innerHTML = json.data.map(a => {
        const preview = a.justificativa ? a.justificativa.substring(0, 60) + (a.justificativa.length > 60 ? '…' : '') : '—';
        return `
        <tr id="jrow-${a.id}" style="cursor:pointer;" onclick="openAnotModal(${a.id}, 'justificadas')">
          <td class="cb-wrap" onclick="event.stopPropagation()"><input type="checkbox" class="cb-row cb-just" data-id="${a.id}" onchange="updateBatchJustSel()" /></td>
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${a.descricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${preview}</td>
          <td class="td-mono">${fmtDate(a.justificativa_enviado_em)}</td>
          <td class="td-mono">${horasResposta(a.approved_at, a.justificativa_enviado_em)}</td>
          <td><span class="pill" style="color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);">Pendente</span></td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-justificadas', 'pag-info-justificadas', ANOT_STATE.justificadas, loadJustificadas);

    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  // ── MODAL DETALHE ──────────────────────────────────
  let _modalAnotId = null;
  let _modalContext = null;

  async function openAnotModal(anotId, context) {
    _modalAnotId = anotId;
    _modalContext = context;

    // Reset
    document.getElementById('manot-error').className = 'alert error';
    document.getElementById('manot-success').className = 'alert success';
    document.getElementById('manot-title').textContent = `Anotação #${anotId}`;
    document.getElementById('manot-id').textContent = '#' + anotId;
    document.getElementById('manot-status').textContent = '...';
    document.getElementById('manot-cad-anot').textContent = '...';
    document.getElementById('manot-cad-resp').textContent = '...';
    document.getElementById('manot-of-resp').textContent = '...';
    document.getElementById('manot-infracao').textContent = '...';
    document.getElementById('manot-data').textContent = '...';
    document.getElementById('manot-data-fato').textContent = '...';
    document.getElementById('manot-descricao').textContent = '...';
    document.getElementById('manot-just-wrap').style.display = 'none';
    document.getElementById('manot-veredito-wrap').style.display = 'none';
    document.getElementById('manot-actions').style.display = 'none';
    document.getElementById('btn-aprovar').disabled = false;
    document.getElementById('btn-aprovar').textContent = '✓ Aprovar';
    document.getElementById('btn-descartar').disabled = false;
    document.getElementById('btn-descartar').textContent = '✕ Descartar';
    document.getElementById('manot-dar-veredito').style.display = 'none';
    document.getElementById('manot-anexos-wrap').style.display = 'none';
    document.getElementById('manot-anexos-lista').innerHTML = '<div class="anexo-empty">—</div>';
    document.getElementById('manot-anexos-count').textContent = '';
    document.getElementById('btn-modal-edit-infracao').style.display = 'none';
    document.getElementById('manot-infracao-editor').style.display = 'none';
    document.getElementById('btn-manot-edit-descr').style.display = 'none';
    document.getElementById('manot-descricao-editor').style.display = 'none';
    document.getElementById('veredito-resultado').value = '';
    aplicarTiposPunicaoPermitidos('veredito-resultado');
    document.getElementById('veredito-observacao').value = '';
    _datasVeredito = [];
    dpInit('dp-cumpr', { mode: 'multi', pillsId: 'dp-cumpr-pills', onChange: (dates) => { _datasVeredito = dates; } });
    document.getElementById('veredito-cumprimento-wrap').style.display = 'none';
    document.getElementById('modal-anot').classList.add('open');

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) { showAlert('manot-error', 'Erro ao carregar anotação.'); return; }
      const a = await res.json();
      window._modalAnotData = a;

      const statusMap = { pendente: 'Pendente', aprovada: 'Aprovada', descartada: 'Descartada' };
      const statusCls = { pendente: 'pill-pendente', aprovada: 'pill-aprovada', descartada: 'pill-descartada' };

      document.getElementById('manot-status').innerHTML =
        `<span class="pill ${statusCls[a.status] || ''}">${statusMap[a.status] || a.status}</span>`;
      document.getElementById('manot-cad-anot').textContent = resolveUser(a.cad_anot);
      document.getElementById('manot-cad-resp').textContent = resolveUser(a.cad_resp);
      document.getElementById('manot-of-resp').textContent  = resolveOficial(a.of_resp);
      document.getElementById('manot-infracao').textContent = resolveInfracao(a.infracao);
      document.getElementById('manot-data').textContent     = fmtDate(a.created_at);
      document.getElementById('manot-data-fato').textContent = fmtDateOnly(a.data_do_fato);
      document.getElementById('manot-descricao').textContent = a.descricao ?? '—';
      if (a.approved_at) {
        document.getElementById('manot-approved').textContent = fmtDate(a.approved_at);
        document.getElementById('manot-approved-wrap').style.display = '';
      } else {
        document.getElementById('manot-approved-wrap').style.display = 'none';
      }

      // Botão de editar infração
      const _roleEdit = window._currentUser?.role;
      const _canEditInfracao = ['coordenador', 'lider_corpo_alunos', 'comandante_de_companhia', 'comandante_de_pelotao'].includes(_roleEdit)
        ? (a.status !== 'descartada' && !a.veredito)
        : (['xerife', 'dia_cfo', 'dia_curso'].includes(_roleEdit) && a.status === 'pendente');
      document.getElementById('btn-modal-edit-infracao').style.display = _canEditInfracao ? 'inline-flex' : 'none';

      const _isOwner = String(a.cad_resp) === String(window._currentUser?.user_id);
      const _btnEditDescr = document.getElementById('btn-manot-edit-descr');
      if (_btnEditDescr) {
        _btnEditDescr.style.display = (_isOwner && a.status === 'pendente') ? 'inline-flex' : 'none';
        document.getElementById('manot-descricao-texto').value = a.descricao || '';
      }

      // Justificativa
      if (a.justificativa) {
        document.getElementById('manot-just-wrap').style.display = 'block';
        document.getElementById('manot-just-texto').textContent  = a.justificativa || '—';
        document.getElementById('manot-just-data').innerHTML   =
          a.justificativa_enviada
            ? `Enviada em ${fmtDate(a.justificativa_enviado_em)} · Tempo de resposta: ${horasResposta(a.approved_at, a.justificativa_enviado_em)}`
            : 'Rascunho — não enviado';
      }

      // Veredito existente
      if (a.veredito) {
        const resultadoLabel = PUNICAO_LABELS;
        const resultadoStyle = PUNICAO_STYLES;
        document.getElementById('manot-veredito-wrap').style.display = 'block';
        const resEl = document.getElementById('manot-veredito-resultado');
        resEl.textContent = resultadoLabel[a.veredito] ?? a.veredito;
        resEl.style.cssText = resultadoStyle[a.veredito] ?? '';
        document.getElementById('manot-veredito-data').textContent = fmtDate(a.veredito_decidido_em);
        const cwrap = document.getElementById('manot-veredito-cumprimento-wrap');
        const datas = a.veredito_datas_cumprimento;
        if (datas && datas.length) {
          cwrap.style.display = 'block';
          document.getElementById('manot-veredito-cumprimento').innerHTML =
            datas.map(d => `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--warn);background:rgba(224,123,42,.1);border:1px solid rgba(224,123,42,.3);padding:3px 8px;border-radius:4px;cursor:pointer;"
              title="Clique para remover" onclick="manot_removeCumprimento(${a.id},'${d}',this)">${fmtDateOnly(d)} ✕</span>`).join('');
          if (['coordenador', 'lider_corpo_alunos', 'comandante_de_companhia', 'comandante_de_pelotao'].includes(window._currentUser?.role)) document.getElementById('manot-add-data-wrap').style.display = 'flex';
        } else { cwrap.style.display = 'none'; }
        if (a.veredito_observacao) {
          document.getElementById('manot-veredito-obs-wrap').style.display = 'block';
          document.getElementById('manot-veredito-obs').textContent = a.veredito_observacao;
        } else {
          document.getElementById('manot-veredito-obs-wrap').style.display = 'none';
        }

        // Botão reverter: só coordenador, só dentro de 24h
        // (demais papéis não dão veredito normal — staff de liderança usa pernoite inopinado)
        const reverterWrap = document.getElementById('manot-reverter-wrap');
        if (window._currentUser?.role === 'coordenador' && a.veredito_decidido_em) {
          const horasPassadas = (Date.now() - new Date(a.veredito_decidido_em)) / 3600000;
          if (horasPassadas < 24) {
            const restam = Math.max(0, 24 - horasPassadas);
            const hh = Math.floor(restam);
            const mm = Math.round((restam - hh) * 60);
            document.getElementById('manot-reverter-prazo').textContent =
              `Prazo: ${hh}h ${mm}min restantes`;
            reverterWrap.style.display = 'block';
          } else {
            reverterWrap.style.display = 'none';
          }
        } else {
          reverterWrap.style.display = 'none';
        }
      }

      // Aprovar / descartar: só se pendente
      if (a.status === 'pendente') {
        document.getElementById('manot-actions').style.display = 'block';
      }

      // Dar veredito: aprovada + justificativa enviada + sem veredito ainda
      // (demais papéis não dão veredito normal — staff de liderança usa pernoite inopinado)
      if (a.status === 'aprovada' && a.justificativa_enviada && !a.veredito &&
          window._currentUser?.role === 'coordenador') {
        document.getElementById('manot-dar-veredito').style.display = 'block';
      }

      // Anexos — sempre visível para coordenador
      document.getElementById('manot-anexos-wrap').style.display = 'block';
      document.getElementById('manot-anexos-lista').innerHTML = '<div class="anexo-empty">carregando...</div>';
      loadManotAnexos(anotId);

    } catch {
      showAlert('manot-error', 'Erro de conexão.');
    }
  }

  function toggleManotDescrEditor(open) {
    document.getElementById('manot-descricao-editor').style.display = open ? 'block' : 'none';
    document.getElementById('btn-manot-edit-descr').style.display = open ? 'none' : 'inline-flex';
  }

  async function submitManotDescricao() {
    const btn = document.getElementById('btn-manot-descr-save');
    const texto = document.getElementById('manot-descricao-texto').value.trim();
    btn.classList.add('btn-loading'); btn.textContent = '...';
    try {
      const res = await fetch(`${API}/anotacoes/${_modalAnotId}/descricao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ descricao: texto }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('manot-error', data.detail || 'Erro ao atualizar descrição.'); return; }
      document.getElementById('manot-descricao').textContent = texto || '—';
      toggleManotDescrEditor(false);
      toast('Descrição atualizada.');
    } catch { showAlert('manot-error', 'Erro de conexão.'); }
    finally { btn.classList.remove('btn-loading'); btn.textContent = 'SALVAR'; }
  }

  function closeAnotModal() {
    document.getElementById('modal-anot').classList.remove('open');
    _modalAnotId = null;
    _modalContext = null;
  }
  async function submitStatus(status) {
    if (!_modalAnotId) return;
    const btnAp = document.getElementById('btn-aprovar');
    const btnDs = document.getElementById('btn-descartar');
    btnAp.disabled = btnDs.disabled = true;
    btnAp.textContent = btnDs.textContent = '...';

    try {
      const res = await fetch(`${API}/anotacoes/${_modalAnotId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        showAlert('manot-error', data.detail || 'Erro.');
        btnAp.disabled = btnDs.disabled = false;
        btnAp.textContent = '✓ Aprovar'; btnDs.textContent = '✕ Descartar';
        return;
      }
      btnAp.disabled = btnDs.disabled = false;
      btnAp.textContent = '✓ Aprovar'; btnDs.textContent = '✕ Descartar';
      toast(`Anotação #${_modalAnotId} ${status === 'aprovada' ? 'aprovada' : 'descartada'}.`);
      closeAnotModal();
      loadPendentes(ANOT_STATE.pendentes.page);
    } catch {
      showAlert('manot-error', 'Erro de conexão.');
      btnAp.disabled = btnDs.disabled = false;
      btnAp.textContent = '✓ Aprovar'; btnDs.textContent = '✕ Descartar';
    }
  }

  // ── COM VEREDITO ──────────────────────────────────
  let _veredAnoInit = false;
  async function loadVeredito(page = 1) {
    const tbody = document.getElementById('tbody-veredito');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';

    if (!_veredAnoInit) {
      _veredAnoInit = true;
      const anoSel = document.getElementById('filter-verd-ano');
      if (anoSel && anoSel.options.length <= 1) {
        const y = new Date().getFullYear();
        anoSel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Todos' }));
        for (let yr = y - 2; yr <= y + 1; yr++) {
          const o = document.createElement('option');
          o.value = yr; o.textContent = yr;
          if (yr === y) o.selected = true;
          anoSel.appendChild(o);
        }
      }
    }

    const resultado  = document.getElementById('filter-veredito-resultado')?.value ?? '';
    const cadeteIdV  = getSdValue('sd-cadete-veredito');
    const infracaoV  = getSdValue('sd-infracao-veredito');
    const dataFatoV  = document.getElementById('filter-verd-data-fato')?.value || '';
    const mesV       = document.getElementById('filter-verd-mes')?.value || '';
    const anoV       = document.getElementById('filter-verd-ano')?.value || '';
    const tpVRaw = document.getElementById('tp-filter-veredito')?.value ?? '';
    const [tpVTurma, tpVPel] = tpVRaw ? tpVRaw.split('-') : ['', ''];
    const params = new URLSearchParams({ veredito_status: 'dado', page, limit: LIMIT });
    if (resultado)  params.set('resultado',  resultado);
    if (cadeteIdV)  params.set('cadete_id',  cadeteIdV);
    if (infracaoV)  params.set('infracao',   infracaoV);
    if (dataFatoV)  params.set('data_fato',  dataFatoV);
    if (mesV)       params.set('mes',        mesV);
    if (anoV)       params.set('ano',        anoV);
    if (tpVTurma)   params.set('turma',      tpVTurma);
    if (tpVPel)     params.set('pel',        tpVPel);
    if (cursoAtivoId() != null) params.set('curso_id', cursoAtivoId());
    applySort(params, 'veredito');

    try {
      const res = await fetch(`${API}/coordenador/anotacoes?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      ANOT_STATE.veredito = { page, total: json.total, data: json.data };

      document.getElementById('meta-veredito').textContent =
        `${json.total} anotação(ões) com veredito registrado`;

      const resultadoLabel = {
        justificada:             'Justificada',
        perda_de_ponto:          'Perda de Ponto',
        pernoite:                'Pernoite',
        'licença_nao_concedida': 'Licença Não Concedida',
        recolher:                'Recolher',
      };
      const resultadoStyle = {
        justificada:             'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);',
        perda_de_ponto:          'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);',
        pernoite:                'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
        'licença_nao_concedida': 'color:#ed1e24;border-color:rgba(180,10,10,.25);background:rgba(237,30,36,.08);',
        recolher:                'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
        servico_extra:           'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
        pre_alvorada:            'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
        trabalhos_e_estudos:     'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
      };

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO ENCONTRADA</td></tr>';
        document.getElementById('pag-info-veredito').textContent = '0 registros';
        document.getElementById('pag-btns-veredito').innerHTML = '';
        return;
      }

      window._veredatoData = json.data;
      tbody.innerHTML = json.data.map(a => {
        const preview = a.justificativa
          ? a.justificativa.substring(0, 55) + (a.justificativa.length > 55 ? '…' : '')
          : '—';
        const res_label = resultadoLabel[a.veredito] ?? a.veredito ?? '—';
        const res_style = resultadoStyle[a.veredito] ?? 'color:var(--muted);';
        const obs = a.veredito_observacao
          ? a.veredito_observacao.substring(0, 50) + (a.veredito_observacao.length > 50 ? '…' : '')
          : '<span style="color:var(--muted);">—</span>';
        const isPun = ['pernoite','recolher','licença_nao_concedida'].includes(a.veredito);
        return `
        <tr style="cursor:pointer;" id="vrow-${a.id}" onclick="openAnotModal(${a.id}, 'veredito')">
          <td class="cb-wrap" onclick="event.stopPropagation()">${isPun ? `<input type="checkbox" class="cb-row cb-veredito" data-id="${a.id}" onchange="updateBatchVereditoSel()">` : ''}</td>
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${a.descricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${preview}</td>
          <td class="td-mono">${horasResposta(a.approved_at, a.justificativa_enviado_em)}</td>
          <td class="td-mono">${fmtDate(a.veredito_decidido_em)}</td>
          <td><span class="pill" style="${res_style}">${res_label}</span></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${obs}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-veredito', 'pag-info-veredito', ANOT_STATE.veredito, loadVeredito);

    } catch {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }


  // ── EDITAR INFRAÇÃO NO MODAL ──────────────────────────────────
  function openModalEditInfracao() {
    const editor  = document.getElementById('manot-infracao-editor');
    const isOpen  = editor.style.display !== 'none';
    editor.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const search = document.getElementById('manot-infracao-search');
      search.value = '';
      // Populate list
      const listEl = document.getElementById('manot-infracao-list');
      const currentId = window._modalAnotData?.infracao;
      listEl.innerHTML = Object.entries(window._transgMap).map(([id, t]) => {
        const label = t.code ? `${t.code} — ${t.descr}` : t.descr;
        const pts   = t.discount != null ? `${t.discount > 0 ? '-' : ''}${t.discount} pt` : '';
        const sel   = Number(id) === Number(currentId) ? 'sd-selected' : '';
        return `<div class="sd-option ${sel}" data-value="${id}" data-search="${label.toLowerCase()}"
          onclick="saveModalInfracao(${id})">
          <span class="sd-option-label">${label}</span>
          <span class="sd-option-pts">${pts}</span>
        </div>`;
      }).join('');
      search.focus();
    }
  }

  async function saveModalInfracao(newInfracaoId) {
    if (!_modalAnotId) return;
    try {
      const res = await fetch(`${API}/anotacoes/${_modalAnotId}/infracao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ infracao: newInfracaoId }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('manot-error', data.detail || 'Erro ao alterar infração.'); return; }
      // Update display
      window._modalAnotData.infracao = newInfracaoId;
      document.getElementById('manot-infracao').textContent = resolveInfracao(newInfracaoId);
      document.getElementById('manot-infracao-editor').style.display = 'none';
      toast(`Infração atualizada.`);
      // Reload underlying table
      if (_modalContext === 'pendente')     loadPendentes(ANOT_STATE.pendentes.page);
      if (_modalContext === 'justificativa') loadJustificativa(ANOT_STATE.justificativa.page);
    } catch {
      showAlert('manot-error', 'Erro de conexão.');
    }
  }

  // ── DAR VEREDITO NO MODAL ──────────────────────────────────
  let _datasVeredito = []; // lista de datas adicionadas no form

  function toggleVeredtoCumprimento() {
    const resultado = document.getElementById('veredito-resultado').value;
    const requer = ['pernoite', 'recolher', 'licença_nao_concedida', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'];
    const wrap = document.getElementById('veredito-cumprimento-wrap');
    wrap.style.display = requer.includes(resultado) ? 'block' : 'none';
    if (!requer.includes(resultado)) {
      _datasVeredito = [];
      dpClear('dp-cumpr');
    } else {
      if (!_dpState['dp-cumpr']) {
        dpInit('dp-cumpr', { mode: 'multi', pillsId: 'dp-cumpr-pills', onChange: (dates) => { _datasVeredito = dates; } });
      } else {
        dpRender('dp-cumpr');
      }
    }
  }

  async function reverterVeredito() {
    if (!_modalAnotId) return;
    if (!confirm('Reverter o veredito desta anotação? A justificativa será mantida e um novo veredito poderá ser registrado.')) return;
    try {
      const res = await fetch(`${API}/anotacoes/${_modalAnotId}/veredito`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const json = await res.json();
      if (!res.ok) { showAlert('manot-error', json.detail || 'Erro ao reverter.'); return; }
      closeAnotModal();
      loadVeredito();
    } catch {
      showAlert('manot-error', 'Erro de conexão.');
    }
  }

  async function submitVeredito() {
    if (!_modalAnotId) return;
    const resultado        = document.getElementById('veredito-resultado').value;
    const observacao       = document.getElementById('veredito-observacao').value.trim();
    const requerData       = ['pernoite', 'recolher', 'licença_nao_concedida', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'];
    if (!resultado) { showAlert('manot-error', 'Selecione um resultado.'); return; }
    const _datasVeredito = dpGetSelected('dp-cumpr');
    if (requerData.includes(resultado) && !_datasVeredito.length) {
      showAlert('manot-error', 'Adicione ao menos uma data de cumprimento para este resultado.'); return;
    }

    const btn = document.getElementById('btn-dar-veredito');
    btn.classList.add('btn-loading');
    btn.textContent = 'AGUARDE...';
    document.getElementById('manot-error').className = 'alert error';

    try {
      const res = await fetch(`${API}/anotacoes/${_modalAnotId}/veredito`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ resultado, observacao: observacao || null, datas_cumprimento: _datasVeredito.length ? _datasVeredito : null }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('manot-error', data.detail || 'Erro ao registrar veredito.'); return; }

      showAlert('manot-success', 'Veredito registrado com sucesso.', 'success');
      document.getElementById('manot-dar-veredito').style.display = 'none';
      document.getElementById('btn-modal-edit-infracao').style.display = 'none';

      // Mostrar o veredito recém-registrado
      const resultadoLabel = PUNICAO_LABELS;
      const resultadoStyle = PUNICAO_STYLES;
      document.getElementById('manot-veredito-wrap').style.display = 'block';
      const resEl = document.getElementById('manot-veredito-resultado');
      resEl.textContent = resultadoLabel[resultado] ?? resultado;
      resEl.style.cssText = resultadoStyle[resultado] ?? '';
      document.getElementById('manot-veredito-data').textContent = fmtDate(data.decidido_em);
      const cumprWrap = document.getElementById('manot-veredito-cumprimento-wrap');
      const requerData2 = ['pernoite', 'recolher', 'licença_nao_concedida', 'servico_extra', 'pre_alvorada', 'trabalhos_e_estudos'];
      if (_datasVeredito.length && requerData2.includes(resultado)) {
        cumprWrap.style.display = 'block';
        document.getElementById('manot-veredito-cumprimento').innerHTML =
          _datasVeredito.map(d => `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--warn);background:rgba(224,123,42,.1);border:1px solid rgba(224,123,42,.3);padding:3px 8px;border-radius:4px;">${fmtDateOnly(d)}</span>`).join('');
        if (['coordenador', 'lider_corpo_alunos', 'comandante_de_companhia', 'comandante_de_pelotao'].includes(window._currentUser?.role)) document.getElementById('manot-add-data-wrap').style.display = 'flex';
      } else { cumprWrap.style.display = 'none'; }
      _datasVeredito = []; dpClear('dp-cumpr');
      if (observacao) {
        document.getElementById('manot-veredito-obs-wrap').style.display = 'block';
        document.getElementById('manot-veredito-obs').textContent = observacao;
      }

      toast('Veredito registrado.');
      // Reload underlying table
      if (_modalContext === 'justificadas') loadJustificadas(ANOT_STATE.justificadas.page);
      if (_modalContext === 'veredito')     loadVeredito(ANOT_STATE.veredito.page);

    } catch {
      showAlert('manot-error', 'Erro de conexão.');
    } finally {
      btn.classList.remove('btn-loading');
      btn.textContent = 'REGISTRAR VEREDITO';
    }
  }


  // ══════════════════════════════════════════════════
  // DIA CFO — LOOKUPS (transgressoes + oficiais)
  // ══════════════════════════════════════════════════
  async function loadLookupsDiaCfo() {
    try {
      const [resTrans, resOficiais] = await Promise.all([
        fetch(`${API}/transgressoes`,   { headers: { 'Authorization': `Bearer ${token()}` } }),
        fetch(`${API}/oficiais-de-dia`, { headers: { 'Authorization': `Bearer ${token()}` } }),
      ]);
      if (resTrans.ok) {
        const trans = await resTrans.json();
        window._transgMap = {};
        trans.forEach(t => { window._transgMap[t.id] = { descr: t.descr, code: t.code, discount: t.discount }; });
      }
      if (resOficiais.ok) {
        const oficiais = await resOficiais.json();
        window._oficiaisMap = {};
        oficiais.forEach(o => { window._oficiaisMap[o.id] = { nome_de_guerra: o.nome_de_guerra, posto: o.posto }; });
      }
      // Carrega lista de cadetes/dia_cfo para o dropdown de lançamento e resolveUser
      try {
        const resUsers = await fetch(`${API}/usuarios/cadetes${qsCurso()}`, { headers: { 'Authorization': `Bearer ${token()}` } });
        if (resUsers.ok) {
          const users = await resUsers.json();
          window._allUsuarios = users;
          users.forEach(u => { window._usersMap[u.id] = { username: u.username, numero_geral: u.numero_geral, turma: u.turma, pel: u.pel }; });
          // Re-seed current user in case map was just built from cadetes only
          const cu = window._currentUser;
          if (cu) window._usersMap[cu.user_id] = { username: cu.username, numero_geral: cu.numero_geral, turma: cu.turma, pel: cu.pel };
          populateCadetesLancamento();
          populatePelLancamento();
        }
      } catch {}
    } catch {}
  }

  // ══════════════════════════════════════════════════
  // DIA CFO — LANÇAMENTO EM LOTE
  // ══════════════════════════════════════════════════
  let _lancCadetes = []; // [{id, label}]

  function initLancamento() {
    // Popula dropdown de oficiais
    const ofList = document.getElementById('sd-oficial-lancamento-list');
    if (ofList && Object.keys(window._oficiaisMap).length) {
      ofList.innerHTML = Object.entries(window._oficiaisMap).map(([id, o]) => {
        const label = o.posto ? `${o.posto} ${o.nome_de_guerra}` : o.nome_de_guerra;
        return `<div class="sd-option" data-value="${id}" data-search="${label.toLowerCase()}"
          onclick="selectSdLancamento('oficial', ${id}, '${label.replace(/'/g, "\\'")}')">
          <span class="sd-option-label">${label}</span>
        </div>`;
      }).join('');
    }

    // Popula dropdown de infrações
    const infList = document.getElementById('sd-infracao-lancamento-list');
    if (infList && Object.keys(window._transgMap).length) {
      infList.innerHTML = Object.entries(window._transgMap).map(([id, t]) => {
        const label = t.code ? `${t.code} — ${t.descr}` : t.descr;
        const pts   = t.discount != null ? `${t.discount > 0 ? '-' : ''}${t.discount} pt` : '';
        return `<div class="sd-option" data-value="${id}" data-search="${label.toLowerCase()}"
          onclick="selectSdLancamento('infracao', ${id}, '${(t.code || t.descr).replace(/'/g, "\\'")}', ${t.discount ?? 0})">
          <span class="sd-option-label">${label}</span>
          <span class="sd-option-pts">${pts}</span>
        </div>`;
      }).join('');
    }

    // Popula dropdown de cadetes
    populateCadetesLancamento();
  }

  function populateCadetesLancamento() {
    const list = document.getElementById('sd-cadetes-lancamento-list');
    if (!list) return;
    const cadetes = window._allUsuarios; // todos — dia_cfo e xerife também podem ser anotados
    if (!cadetes.length) {
      list.innerHTML = '<div class="sd-option" style="color:var(--muted);cursor:default;">Nenhum aluno disponível</div>';
      return;
    }
    list.innerHTML = cadetes
      .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999))
      .map(u => {
        const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
        return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
          onclick="adicionarCadete(${u.id}, '${label.replace(/'/g, "\\'")}')">
          <span class="sd-option-label">${label}</span>
        </div>`;
      }).join('');
  }

  // Estado dos dropdowns de lançamento
  const _lancState = { oficial: null, infracao: null, infracaoDiscount: null };

  function selectSdLancamento(tipo, id, label, discount) {
    _lancState[tipo] = id;
    if (tipo === 'infracao') _lancState.infracaoDiscount = discount;

    const trigger = document.getElementById(`sd-${tipo === 'oficial' ? 'oficial' : 'infracao'}-lancamento-trigger`);
    if (trigger) trigger.textContent = label;
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));

    if (tipo === 'infracao') {
      const pts = discount != null ? `${discount > 0 ? '-' : ''}${discount} pt` : '';
      document.getElementById('lancamento-infracao-pts').textContent = pts;
      document.getElementById('resumo-infracao').textContent = label;
      document.getElementById('resumo-pts').textContent = pts || '—';
    }
    if (tipo === 'oficial') {
      document.getElementById('resumo-oficial').textContent = label;
    }
  }

  function adicionarCadete(id, label) {
    // Fecha dropdown
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    // Evita duplicatas
    if (_lancCadetes.find(c => c.id === id)) {
      toast(`${label} já foi adicionado.`, 'error');
      return;
    }
    _lancCadetes.push({ id, label });
    renderCadetesLancamento();
  }

  function adicionarPelotao() {
    const val = document.getElementById('sel-pel-lancamento')?.value;
    if (!val) { toast('Selecione um pelotão.', 'error'); return; }
    const [turma, pel] = val.split('-');
    const cadetes = (window._allUsuarios || []).filter(u =>
      String(u.turma) === turma && u.pel === pel &&
      ['cadete', 'aluno', 'dia_cfo', 'dia_curso', 'xerife'].includes(u.role)
    );
    if (!cadetes.length) { toast('Nenhum cadete encontrado neste pelotão.', 'error'); return; }
    let adicionados = 0;
    cadetes.forEach(u => {
      if (!_lancCadetes.find(c => c.id === u.id)) {
        _lancCadetes.push({ id: u.id, label: u.username });
        adicionados++;
      }
    });
    renderCadetesLancamento();
    toast(adicionados > 0 ? `${adicionados} cadete(s) do pelotão adicionados.` : 'Todos os cadetes do pelotão já estão na lista.');
  }

  function populatePelLancamento() {
    const sel = document.getElementById('sel-pel-lancamento');
    if (!sel) return;
    const grupos = {};
    (window._allUsuarios || []).forEach(u => {
      if (!['cadete', 'aluno', 'dia_cfo', 'dia_curso', 'xerife'].includes(u.role)) return;
      if (u.turma == null || !u.pel) return;
      const key = `${u.turma}-${u.pel}`;
      grupos[key] = true;
    });
    const keys = Object.keys(grupos).sort();
    sel.innerHTML = '<option value="">— Selecionar —</option>' +
      keys.map(k => {
        const [t, p] = k.split('-');
        return `<option value="${k}">Turma ${t} · Pel ${p}</option>`;
      }).join('');
  }

  function removerCadete(id) {
    _lancCadetes = _lancCadetes.filter(c => c.id !== id);
    renderCadetesLancamento();
  }

  function renderCadetesLancamento() {
    const lista = document.getElementById('lanc-cadetes-lista');
    const count = document.getElementById('lanc-cadetes-count');
    const resumo = document.getElementById('resumo-cadetes');
    count.textContent = `${_lancCadetes.length} selecionado(s)`;
    resumo.textContent = _lancCadetes.length;

    if (!_lancCadetes.length) {
      lista.innerHTML = '<div class="cadetes-vazio">Nenhum aluno adicionado</div>';
      return;
    }
    lista.innerHTML = _lancCadetes.map(c => `
      <div class="cadete-tag">
        <span class="cadete-tag-name">${c.label}</span>
        <button class="cadete-tag-remove" onclick="removerCadete(${c.id})" title="Remover">✕</button>
      </div>`).join('');
  }

  function updateAnexosList() {
    const input   = document.getElementById('lanc-anexos');
    const label   = document.getElementById('lanc-anexos-label');
    const preview = document.getElementById('lanc-anexos-preview');
    const files   = Array.from(input.files);
    label.textContent = files.length ? `${files.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado';
    preview.innerHTML = files.map(f =>
      `<span style="font-family:'IBM Plex Mono',monospace;font-size:10px;background:var(--surface2);border:1px solid var(--border);padding:3px 8px;border-radius:4px;color:var(--text-dim);">📎 ${f.name}</span>`
    ).join('');
  }

  function resetLancamento() {
    _lancCadetes = [];
    _lancState.oficial = null;
    _lancState.infracao = null;
    _lancState.infracaoDiscount = null;

    const fields = [
      ['sd-oficial-lancamento-trigger',  '— Selecione o superior —'],
      ['sd-infracao-lancamento-trigger', '— Selecione a infração —'],
      ['sd-cadetes-lancamento-trigger',  'Buscar e adicionar aluno...'],
    ];
    fields.forEach(([id, txt]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    });

    document.getElementById('lanc-descricao').value = '';
    document.getElementById('lanc-data-fato').value = '';
    const anexosInput = document.getElementById('lanc-anexos');
    if (anexosInput) { anexosInput.value = ''; updateAnexosList(); }
    document.getElementById('lancamento-infracao-pts').textContent = '';
    document.getElementById('resumo-oficial').textContent = '—';
    document.getElementById('resumo-infracao').textContent = '—';
    document.getElementById('resumo-pts').textContent = '—';
    document.getElementById('resumo-data-fato').textContent = '—';
    document.getElementById('resumo-cadetes').textContent = '0';
    document.getElementById('lanc-error').className = 'alert error';
    document.getElementById('lanc-success').className = 'alert success';
    document.getElementById('lanc-resultado-card').style.display = 'none';
    document.getElementById('lote-resultado-lista').innerHTML = '';
    renderCadetesLancamento();
  }

  // ══════════════════════════════════════════════════
  // PERNOITE INOPINADO
  // ══════════════════════════════════════════════════
  let _pernoiteCadetes = []; // [{id, label}] - mesmo padrão de _lancCadetes

  async function initPernoiteInopinado() {
    resetPernoiteInopinado();
    populatePernoiteAlunoList();
    popularPelPernoite();
    const sel = document.getElementById('pernoite-resultado');
    const tipos = tiposPunicaoPermitidos(window._currentUser?.role);
    sel.innerHTML = tipos.length
      ? tipos.map(t => `<option value="${t}">${PUNICAO_LABELS[t]}</option>`).join('')
      : '<option value="">Nenhum tipo de punição disponível pro seu papel</option>';
    updateResumoPernoite();
  }

  function populatePernoiteAlunoList() {
    const list = document.getElementById('sd-pernoite-aluno-list');
    if (!list) return;
    const alunos = window._allUsuarios || [];
    if (!alunos.length) {
      list.innerHTML = '<div class="sd-option" style="color:var(--muted);cursor:default;">Nenhum aluno disponível</div>';
      return;
    }
    list.innerHTML = alunos
      .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999))
      .map(u => {
        const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
        return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
          onclick="adicionarAlunoPernoite(${u.id}, '${label.replace(/'/g, "\\'")}')">
          <span class="sd-option-label">${label}</span>
        </div>`;
      }).join('');
  }

  function popularPelPernoite() {
    const sel = document.getElementById('sel-pel-pernoite');
    if (!sel) return;
    const grupos = {};
    (window._allUsuarios || []).forEach(u => {
      if (!['cadete', 'aluno', 'dia_cfo', 'dia_curso', 'xerife'].includes(u.role)) return;
      if (u.turma == null || !u.pel) return;
      grupos[`${u.turma}-${u.pel}`] = true;
    });
    const keys = Object.keys(grupos).sort();
    sel.innerHTML = '<option value="">— Selecionar —</option>' +
      keys.map(k => {
        const [t, p] = k.split('-');
        return `<option value="${k}">Turma ${t} · Pel ${p}</option>`;
      }).join('');
  }

  function adicionarAlunoPernoite(id, label) {
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    if (_pernoiteCadetes.find(c => c.id === id)) {
      toast(`${label} já foi adicionado.`, 'error');
      return;
    }
    _pernoiteCadetes.push({ id, label });
    renderAlunosPernoite();
  }

  function adicionarPelotaoPernoite() {
    const val = document.getElementById('sel-pel-pernoite')?.value;
    if (!val) { toast('Selecione um pelotão.', 'error'); return; }
    const [turma, pel] = val.split('-');
    const alunos = (window._allUsuarios || []).filter(u =>
      String(u.turma) === turma && u.pel === pel &&
      ['cadete', 'aluno', 'dia_cfo', 'dia_curso', 'xerife'].includes(u.role)
    );
    if (!alunos.length) { toast('Nenhum aluno encontrado neste pelotão.', 'error'); return; }
    let adicionados = 0;
    alunos.forEach(u => {
      if (!_pernoiteCadetes.find(c => c.id === u.id)) {
        _pernoiteCadetes.push({ id: u.id, label: u.username });
        adicionados++;
      }
    });
    renderAlunosPernoite();
    toast(adicionados > 0 ? `${adicionados} aluno(s) do pelotão adicionados.` : 'Todos os alunos do pelotão já estão na lista.');
  }

  function removerAlunoPernoite(id) {
    _pernoiteCadetes = _pernoiteCadetes.filter(c => c.id !== id);
    renderAlunosPernoite();
  }

  function renderAlunosPernoite() {
    const lista = document.getElementById('pernoite-cadetes-lista');
    const count = document.getElementById('pernoite-cadetes-count');
    count.textContent = `${_pernoiteCadetes.length} selecionado(s)`;
    lista.innerHTML = _pernoiteCadetes.length
      ? _pernoiteCadetes.map(c => `
          <div class="cadete-tag">
            <span class="cadete-tag-name">${c.label}</span>
            <button class="cadete-tag-remove" onclick="removerAlunoPernoite(${c.id})" title="Remover">✕</button>
          </div>`).join('')
      : '<div class="cadetes-vazio">Nenhum aluno adicionado</div>';
    updateResumoPernoite();
  }

  function updateResumoPernoite() {
    document.getElementById('resumo-pernoite-cadetes').textContent = _pernoiteCadetes.length;
    const resultado = document.getElementById('pernoite-resultado').value;
    document.getElementById('resumo-pernoite-resultado').textContent = resultado ? PUNICAO_LABELS[resultado] : '—';
    const datas = dpGetSelected('dp-pernoite-cumpr');
    document.getElementById('resumo-pernoite-datas').textContent = datas.length ? datas.map(fmtDateOnly).join(', ') : '—';
  }

  function resetPernoiteInopinado() {
    _pernoiteCadetes = [];
    document.getElementById('sd-pernoite-aluno-trigger').textContent = 'Buscar e adicionar aluno...';
    document.getElementById('pernoite-descricao').value = '';
    dpClear('dp-pernoite-cumpr');
    document.getElementById('pernoite-error').className = 'alert error';
    document.getElementById('pernoite-success').className = 'alert success';
    document.getElementById('pernoite-resultado-card').style.display = 'none';
    document.getElementById('pernoite-lote-resultado-lista').innerHTML = '';
    renderAlunosPernoite();
  }

  async function submitPernoiteInopinado() {
    const descricao  = document.getElementById('pernoite-descricao').value.trim();
    const resultado  = document.getElementById('pernoite-resultado').value;
    const dataFato   = document.getElementById('pernoite-data-fato').value;
    const datasCumpr = dpGetSelected('dp-pernoite-cumpr');

    document.getElementById('pernoite-error').className = 'alert error';
    document.getElementById('pernoite-success').className = 'alert success';

    if (!_pernoiteCadetes.length) { showAlert('pernoite-error', 'Adicione ao menos um aluno.'); return; }
    if (!descricao)        { showAlert('pernoite-error', 'Descreva o motivo.'); return; }
    if (!resultado)        { showAlert('pernoite-error', 'Selecione o tipo de punição.'); return; }
    if (!datasCumpr.length) { showAlert('pernoite-error', 'Adicione ao menos uma data de cumprimento.'); return; }

    if (!confirm(`Confirma o lançamento de ação corretiva para ${_pernoiteCadetes.length} aluno(s)?`)) return;

    const btn = document.getElementById('btn-pernoite-lancar');
    btn.classList.add('btn-loading');
    btn.disabled = true;

    const resultadoCard  = document.getElementById('pernoite-resultado-card');
    const resultadoLista = document.getElementById('pernoite-lote-resultado-lista');
    resultadoCard.style.display = 'block';
    resultadoLista.innerHTML = _pernoiteCadetes.map(c =>
      `<div class="lote-item pend" id="pernoite-lote-${c.id}">⏳ ${c.label}</div>`
    ).join('');

    let ok = 0, err = 0;

    // Lança sequencialmente para não sobrecarregar a API
    for (const cadete of _pernoiteCadetes) {
      const el = document.getElementById(`pernoite-lote-${cadete.id}`);
      try {
        const res = await fetch(`${API}/pernoite-inopinado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({
            cad_anot: cadete.id,
            descricao,
            resultado,
            datas_cumprimento: datasCumpr,
            data_do_fato: dataFato || null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          el.className = 'lote-item ok';
          el.textContent = `✓ ${cadete.label} — #${data.anotacao_id}`;
          ok++;
        } else {
          el.className = 'lote-item err';
          el.textContent = `✗ ${cadete.label} — ${data.detail || 'Erro'}`;
          err++;
        }
      } catch {
        if (el) { el.className = 'lote-item err'; el.textContent = `✗ ${cadete.label} — falha de conexão`; }
        err++;
      }
    }

    btn.classList.remove('btn-loading');
    btn.disabled = false;

    if (err === 0) {
      showAlert('pernoite-success', `Ação corretiva lançada com sucesso para ${ok} aluno(s).`, 'success');
      _pernoiteCadetes = [];
      document.getElementById('sd-pernoite-aluno-trigger').textContent = 'Buscar e adicionar aluno...';
      document.getElementById('pernoite-descricao').value = '';
      dpClear('dp-pernoite-cumpr');
      renderAlunosPernoite();
    } else {
      showAlert('pernoite-error', `${ok} lançado(s) com sucesso, ${err} com erro - veja a lista abaixo.`);
    }
    loadBadges();
  }

  async function lancarLote() {
    const ofResp    = _lancState.oficial;
    const infracao  = _lancState.infracao;
    const descricao = document.getElementById('lanc-descricao').value.trim();
    const dataFato  = document.getElementById('lanc-data-fato').value;

    document.getElementById('lanc-error').className = 'alert error';
    document.getElementById('lanc-success').className = 'alert success';

    if (!ofResp)    { showAlert('lanc-error', 'Selecione o superior responsável.'); return; }
    if (!infracao)  { showAlert('lanc-error', 'Selecione a infração.'); return; }
    if (!dataFato)  { showAlert('lanc-error', 'Informe a data do fato.'); return; }
    if (!_lancCadetes.length) { showAlert('lanc-error', 'Adicione ao menos um aluno.'); return; }

    if (!confirm(`Confirma o lançamento desta anotação para ${_lancCadetes.length} aluno(s)?`)) return;

    const anexosInput = document.getElementById('lanc-anexos');
    const arquivos    = anexosInput ? Array.from(anexosInput.files) : [];

    const btn = document.getElementById('btn-lancar');
    btn.classList.add('btn-loading');
    btn.textContent = 'LANÇANDO...';

    // Mostra resultado card com estado pendente
    const resultadoCard = document.getElementById('lanc-resultado-card');
    const resultadoLista = document.getElementById('lote-resultado-lista');
    resultadoCard.style.display = 'block';
    resultadoLista.innerHTML = _lancCadetes.map(c =>
      `<div class="lote-item pend" id="lote-${c.id}">⏳ ${c.label}</div>`
    ).join('');

    let ok = 0, err = 0;

    // Lança sequencialmente para não sobrecarregar a API
    for (const cadete of _lancCadetes) {
      try {
        const res = await fetch(`${API}/anotacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify({ of_resp: Number(ofResp), cad_anot: cadete.id, infracao: Number(infracao), descricao: descricao, data_do_fato: dataFato, curso_id: cursoAtivoId() }),
        });
        const data = await res.json();
        const el = document.getElementById(`lote-${cadete.id}`);
        if (res.ok) {
          // Upload anexos for this anotacao
          let anexoErro = false;
          for (const arquivo of arquivos) {
            const fd = new FormData();
            fd.append('file', arquivo);
            const ar = await fetch(`${API}/anotacoes/${data.id}/anexo`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token()}` },
              body: fd,
            });
            if (!ar.ok) { anexoErro = true; }
          }
          el.className = 'lote-item ok';
          el.textContent = `✓ ${cadete.label} — #${data.id}${arquivos.length ? (anexoErro ? ' ⚠ (anexo com erro)' : ` 📎 ${arquivos.length}`) : ''}`;
          ok++;
        } else {
          el.className = 'lote-item err';
          el.textContent = `✗ ${cadete.label} — ${data.detail || 'Erro'}`;
          err++;
        }
      } catch {
        const el = document.getElementById(`lote-${cadete.id}`);
        if (el) { el.className = 'lote-item err'; el.textContent = `✗ ${cadete.label} — falha de conexão`; }
        err++;
      }
    }

    btn.classList.remove('btn-loading');
    btn.textContent = '✚ LANÇAR ANOTAÇÕES';

    if (err === 0) {
      showAlert('lanc-success', `${ok} anotação(ões) lançada(s) com sucesso.`, 'success');
      // Reset completo — tudo foi lançado
      setTimeout(() => resetLancamento(), 1200);
    } else if (ok === 0) {
      showAlert('lanc-error', `Todas as ${err} anotação(ões) falharam.`);
    } else {
      // Sucesso parcial — remove só os cadetes que foram lançados com sucesso
      _lancCadetes = _lancCadetes.filter(c => {
        const el = document.getElementById(`lote-${c.id}`);
        return el && el.className.includes('err');
      });
      renderCadetesLancamento();
      showAlert('lanc-success', `${ok} lançada(s) com sucesso, ${err} com erro. Corrija e tente novamente.`, 'success');
    }
  }


  // ══════════════════════════════════════════════════
  // DIA CFO — MINHAS ANOTAÇÕES
  // ══════════════════════════════════════════════════
  let _diacfoAnotId = null;

  async function loadMinhasAnotacoes() {
    const tbody = document.getElementById('tbody-minhas');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';

    try {
      const res = await fetch(`${API}/dia-cfo/anotacoes`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const lista = await res.json();

      // Populate filter dropdown with unique responsáveis
      populateRespMinhasSd(lista);

      // Apply filter
      const respId = getSdValue('sd-resp-minhas');
      const filtrada = respId ? lista.filter(a => a.cad_resp === respId) : lista;

      document.getElementById('meta-minhas').textContent =
        `${filtrada.length} de ${lista.length} anotação(ões) nos últimos 7 dias`;

      // Store all in map
      window._minhasAnotMap = {};
      lista.forEach(a => { window._minhasAnotMap[a.id] = a; });

      if (!filtrada.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO</td></tr>';
        return;
      }

      const statusMap = { pendente: 'Pendente', aprovada: 'Aprovada', descartada: 'Descartada' };
      const statusCls = { pendente: 'pill-pendente', aprovada: 'pill-aprovada', descartada: 'pill-descartada' };
      const currentUserId = window._currentUser?.user_id;

      tbody.innerHTML = filtrada.map(a => {
        const isPendente = a.status === 'pendente';
        const isMinhaAnot = a.cad_resp === currentUserId;
        const isAnot      = a.cad_anot === currentUserId;
        const temDescricao = (isMinhaAnot || isAnot) && !!a.descricao;
        // RESTRITO só para quem não tem relação com a anotação
        const descrPreview = a.descricao
          ? a.descricao.substring(0, 60) + (a.descricao.length > 60 ? '…' : '')
          : (isMinhaAnot || isAnot || a.descricao === '')
            ? '<span style="font-size:10px;color:var(--muted);">sem descrição</span>'
            : '<span style="font-size:10px;letter-spacing:1px;color:var(--muted);font-family:\'IBM Plex Mono\',monospace;">[ RESTRITO ]</span>';
        return `
        <tr style="cursor:pointer;${isMinhaAnot ? '' : 'opacity:.85;'}" onclick="openEditDescr(${a.id})">
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${resolveUser(a.cad_resp)}${isMinhaAnot ? ' <span style="font-size:9px;color:var(--accent);">você</span>' : ''}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${temDescricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${descrPreview}</td>
          <td><span class="pill ${statusCls[a.status] || ''}">${statusMap[a.status] || a.status}</span></td>
          <td>${isMinhaAnot && isPendente
            ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deletarAnotacao(${a.id}, this)">✕ Deletar</button>`
            : ''
          }</td>
        </tr>`;
      }).join('');

    } catch {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  function populateRespMinhasSd(lista) {
    const listEl = document.getElementById('sd-resp-minhas-list');
    if (!listEl) return;
    // Get unique cad_resp ids from lista
    const seen = new Set();
    const resps = lista
      .filter(a => { if (seen.has(a.cad_resp)) return false; seen.add(a.cad_resp); return true; })
      .map(a => a.cad_resp)
      .sort((a, b) => {
        const ua = window._usersMap[a], ub = window._usersMap[b];
        return (ua?.numero_geral ?? 9999) - (ub?.numero_geral ?? 9999);
      });
    listEl.innerHTML = resps.map(id => {
      const label = resolveUser(id);
      return `<div class="sd-option" data-value="${id}" data-search="${label.toLowerCase()}"
        onclick="selectSdOption('sd-resp-minhas', ${id}, '${label.replace(/'/g, String.fromCharCode(39))}', loadMinhasAnotacoes)">
        <span class="sd-option-label">${label}</span>
      </div>`;
    }).join('') || '<div class="sd-option" style="color:var(--muted);cursor:default;">Sem dados</div>';
  }

  function openEditDescr(anotId) {
    _diacfoAnotId = anotId;
    const a = window._minhasAnotMap && window._minhasAnotMap[anotId];
    if (!a) return;

    const statusMap = { pendente: 'Pendente', aprovada: 'Aprovada', descartada: 'Descartada' };
    const statusCls = { pendente: 'pill-pendente', aprovada: 'pill-aprovada', descartada: 'pill-descartada' };
    const isPendente = a.status === 'pendente';

    // Reset
    document.getElementById('diacfo-error').className = 'alert error';
    document.getElementById('diacfo-success').className = 'alert success';
    document.getElementById('diacfo-infracao-editor').style.display = 'none';
    document.getElementById('diacfo-descricao-editor').style.display = 'none';
    document.getElementById('btn-diacfo-edit-infracao').style.display = 'none';
    document.getElementById('btn-diacfo-edit-descr').style.display = 'none';

    // Populate fields
    document.getElementById('diacfo-modal-title').textContent = `Anotação #${a.id}`;
    document.getElementById('diacfo-id').textContent = `#${a.id}`;
    document.getElementById('diacfo-status').innerHTML = `<span class="pill ${statusCls[a.status] || ''}">${statusMap[a.status] || a.status}</span>`;
    document.getElementById('diacfo-cad-anot').textContent = resolveUser(a.cad_anot);
    document.getElementById('diacfo-of-resp').textContent  = resolveOficial(a.of_resp);
    document.getElementById('diacfo-data').textContent     = fmtDate(a.created_at);
    document.getElementById('diacfo-data-fato').textContent = fmtDateOnly(a.data_do_fato);
    document.getElementById('diacfo-infracao').textContent = resolveInfracao(a.infracao);
    document.getElementById('diacfo-descricao-view').textContent = a.descricao || (a.cad_resp !== window._currentUser?.user_id ? '[ Descrição restrita — acesso somente ao cadete anotado e à coordenação ]' : '—');
    document.getElementById('diacfo-descricao-texto').value = a.descricao || '';

    // Show edit buttons only if pendente
    if (isPendente) {
      document.getElementById('btn-diacfo-edit-infracao').style.display = 'inline-flex';
      document.getElementById('btn-diacfo-edit-descr').style.display = 'inline-flex';
    }

    // Carregar anexos
    document.getElementById('diacfo-anexos-lista').innerHTML = '<div class="anexo-empty">carregando...</div>';
    document.getElementById('diacfo-anexos-count').textContent = '';
    document.getElementById('modal-edit-descr').classList.add('open');
    loadDiaCfoAnexos(anotId, isPendente);
  }

  function closeDiaCfoModal() {
    document.getElementById('modal-edit-descr').classList.remove('open');
    _diacfoAnotId = null;
  }

  function toggleDiaCfoInfracaoEditor() {
    const editor = document.getElementById('diacfo-infracao-editor');
    const isOpen = editor.style.display !== 'none';
    editor.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const a = window._minhasAnotMap[_diacfoAnotId];
      const currentId = a ? a.infracao : null;
      const search = document.getElementById('diacfo-infracao-search');
      search.value = '';
      const listEl = document.getElementById('diacfo-infracao-list');
      listEl.innerHTML = Object.entries(window._transgMap).map(([id, t]) => {
        const label = t.code ? `${t.code} — ${t.descr}` : t.descr;
        const pts   = t.discount != null ? `${t.discount > 0 ? '-' : ''}${t.discount} pt` : '';
        const sel   = Number(id) === Number(currentId) ? 'sd-selected' : '';
        return `<div class="sd-option ${sel}" data-value="${id}" data-search="${label.toLowerCase()}"
          onclick="saveDiaCfoInfracao(${id})">
          <span class="sd-option-label">${label}</span>
          <span class="sd-option-pts">${pts}</span>
        </div>`;
      }).join('');
      search.focus();
    }
  }

  async function saveDiaCfoInfracao(newInfracaoId) {
    if (!_diacfoAnotId) return;
    try {
      const res = await fetch(`${API}/anotacoes/${_diacfoAnotId}/infracao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ infracao: newInfracaoId }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('diacfo-error', data.detail || 'Erro ao alterar infração.'); return; }
      window._minhasAnotMap[_diacfoAnotId].infracao = newInfracaoId;
      document.getElementById('diacfo-infracao').textContent = resolveInfracao(newInfracaoId);
      document.getElementById('diacfo-infracao-editor').style.display = 'none';
      toast('Infração atualizada.');
      loadMinhasAnotacoes();
    } catch { showAlert('diacfo-error', 'Erro de conexão.'); }
  }

  function toggleDiaCfoDescrEditor(open) {
    document.getElementById('diacfo-descricao-editor').style.display = open ? 'block' : 'none';
    document.getElementById('diacfo-descricao-view').style.display   = open ? 'none'  : 'block';
    document.getElementById('btn-diacfo-edit-descr').style.display   = open ? 'none'  : 'inline-flex';
    if (open) document.getElementById('diacfo-descricao-texto').focus();
  }

  async function submitDiaCfoDescricao() {
    if (!_diacfoAnotId) return;
    const texto = document.getElementById('diacfo-descricao-texto').value;

    const btn = document.getElementById('btn-diacfo-save-descr');
    btn.classList.add('btn-loading'); btn.textContent = '...';
    document.getElementById('diacfo-error').className = 'alert error';

    try {
      const res = await fetch(`${API}/anotacoes/${_diacfoAnotId}/descricao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ descricao: texto }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('diacfo-error', data.detail || 'Erro ao salvar.'); return; }
      window._minhasAnotMap[_diacfoAnotId].descricao = texto;
      document.getElementById('diacfo-descricao-view').textContent = texto || '—';
      document.getElementById('diacfo-descricao-view').style.fontStyle = texto ? 'normal' : 'italic';
      toggleDiaCfoDescrEditor(false);
      showAlert('diacfo-success', 'Descrição atualizada.', 'success');
      toast('Descrição atualizada.');
      loadMinhasAnotacoes();
    } catch { showAlert('diacfo-error', 'Erro de conexão.'); }
    finally { btn.classList.remove('btn-loading'); btn.textContent = 'SALVAR'; }
  }

  // Legacy alias kept so submitEditDescr calls from DOMContentLoaded don't break
  function submitEditDescr() { submitDiaCfoDescricao(); }

  async function deletarAnotacao(anotId, btn) {
    if (!confirm(`Deletar anotação #${anotId}? Esta ação não pode ser desfeita.`)) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const res = await fetch(`${API}/anotacoes/${anotId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao deletar.', 'error'); btn.disabled = false; btn.textContent = '✕'; return; }
      toast(`Anotação #${anotId} deletada.`);
      loadMinhasAnotacoes();
    } catch {
      toast('Erro de conexão.', 'error');
      btn.disabled = false;
      btn.textContent = '✕';
    }
  }


  // ══════════════════════════════════════════════════
  // SHARED (dia_cfo + cadete) — LOOKUPS
  // ══════════════════════════════════════════════════
  async function loadLookupsCadete() {
    try {
      const [resTrans, resUsers, resOficiais] = await Promise.all([
        fetch(`${API}/transgressoes`,    { headers: { 'Authorization': `Bearer ${token()}` } }),
        fetch(`${API}/usuarios/cadetes${qsCurso()}`, { headers: { 'Authorization': `Bearer ${token()}` } }),
        fetch(`${API}/oficiais-de-dia`,  { headers: { 'Authorization': `Bearer ${token()}` } }),
      ]);
      if (resTrans.ok) {
        const trans = await resTrans.json();
        trans.forEach(t => { window._transgMap[t.id] = { descr: t.descr, code: t.code, discount: t.discount }; });
      }
      if (resUsers.ok) {
        const users = await resUsers.json();
        window._usersMap = {};
        users.forEach(u => { window._usersMap[u.id] = { username: u.username, numero_geral: u.numero_geral, turma: u.turma, pel: u.pel }; });
      }
      if (resOficiais.ok) {
        const oficiais = await resOficiais.json();
        window._oficiaisMap = {};
        oficiais.forEach(o => { window._oficiaisMap[o.id] = { nome_de_guerra: o.nome_de_guerra, posto: o.posto }; });
      }
    } catch {}
  }

  // ══════════════════════════════════════════════════
  // SHARED — JUSTIFICAR
  // ══════════════════════════════════════════════════
  let _justAnotId     = null;
  let _justEnviada    = false;
  window._cadeteAnotMap = {};

  async function loadJustificar() {
    const tbody = document.getElementById('tbody-justificar');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="7">CARREGANDO...</td></tr>';

    try {
      const res = await fetch(`${API}/cadete/anotacoes?limit=100`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      // Filtra: aprovadas, justificativa não enviada
      const lista = json.data.filter(a => a.status === 'aprovada' && !a.justificativa_enviada);

      window._cadeteAnotMap = {};
      json.data.forEach(a => { window._cadeteAnotMap[a.id] = a; });

      const badge = document.getElementById('badge-justificar');
      if (badge) { badge.textContent = lista.length; badge.style.display = lista.length > 0 ? 'inline-block' : 'none'; }

      document.getElementById('meta-justificar').textContent =
        `${lista.length} anotação(ões) aguardando sua justificativa`;

      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO AGUARDANDO JUSTIFICATIVA</td></tr>';
        return;
      }

      tbody.innerHTML = lista.map(a => {
        const temRascunho = a.justificativa && !a.justificativa_enviada;
        const jPreview = a.justificativa
          ? a.justificativa.substring(0, 50) + (a.justificativa.length > 50 ? '…' : '')
          : '—';
        return `
        <tr style="cursor:pointer;" onclick="openJustModal(${a.id})">
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${fmtDate(a.approved_at)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span></td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${a.descricao ? a.descricao.substring(0,60)+(a.descricao.length>60?'…':'') : '<span style="font-size:10px;color:var(--muted);">sem descrição</span>'}</td>
          <td>${temRascunho
            ? '<span class="pill" style="color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);">Rascunho</span>'
            : '<span class="pill" style="color:var(--muted);border-color:var(--border);">Sem rascunho</span>'
          }</td>
          <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openJustModal(${a.id})">✍ Justificar</button></td>
        </tr>`;
      }).join('');

    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  function openJustModal(anotId) {
    _justAnotId = anotId;
    const a = window._cadeteAnotMap[anotId];
    if (!a) return;

    _justEnviada = !!a.justificativa_enviada;

    const statusMap = { pendente: 'Pendente', aprovada: 'Aprovada', descartada: 'Descartada' };
    const statusCls = { pendente: 'pill-pendente', aprovada: 'pill-aprovada', descartada: 'pill-descartada' };

    document.getElementById('just-modal-title').textContent = `Justificativa — Anotação #${a.id}`;
    document.getElementById('just-id').textContent         = `#${a.id}`;
    document.getElementById('just-status').innerHTML       = `<span class="pill ${statusCls[a.status]||''}">${statusMap[a.status]||a.status}</span>`;
    document.getElementById('just-of-resp').textContent    = resolveOficial(a.of_resp);
    document.getElementById('just-cad-resp').textContent   = resolveUser(a.cad_resp);
    document.getElementById('just-infracao').textContent   = resolveInfracao(a.infracao);
    document.getElementById('just-data-fato').textContent  = fmtDateOnly(a.data_do_fato);
    document.getElementById('just-approved').textContent   = fmtDate(a.approved_at);
    if (a.horas_desde_aprovacao != null) {
      const h = Math.floor(Number(a.horas_desde_aprovacao));
      const prazoEl = document.getElementById('just-prazo');
      if (h > 48) {
        prazoEl.innerHTML = `<span style='color:var(--danger);font-weight:700;'>+${h}h — VENCIDO</span>`;
      } else {
        prazoEl.innerHTML = `<span style='color:var(--success);'>${h}h de 48h</span>`;
      }
    }
    document.getElementById('just-descricao').textContent  = a.descricao || 'Sem descrição';
    document.getElementById('just-descricao').style.color  = a.descricao ? 'var(--text-dim)' : 'var(--muted)';
    document.getElementById('just-descricao').style.fontStyle = a.descricao ? 'normal' : 'italic';

    const u = window._currentUser;
    const infracao = resolveInfracao(a.infracao);
    const memorando = u
      ? `Prezado(a) ${u.cargo || 'CAD BM'} ${u.numero_geral ?? ''} ${u.username},\n\nDeveis justificar no prazo de 48h sua anotação por ${infracao}.\n\nAtenciosamente,\nCoordenação CFO BM`
      : '';
    document.getElementById('just-memorando').textContent = memorando;

    document.getElementById('just-texto').value = a.justificativa || '';
    document.getElementById('just-error').className   = 'alert error';
    document.getElementById('just-success').className = 'alert success';

    // Se já enviada: bloquear edição
    const enviada = !!a.justificativa_enviada;
    document.getElementById('just-texto').disabled          = enviada;
    document.getElementById('btn-just-rascunho').style.display = enviada ? 'none' : 'inline-flex';
    document.getElementById('btn-just-enviar').style.display   = enviada ? 'none' : 'inline-flex';
    document.getElementById('just-enviada-aviso').style.display = enviada ? 'block' : 'none';

    document.getElementById('modal-justificativa').classList.add('open');
    loadJustAnexos(anotId, !enviada);
  }

  function closeJustModal() {
    document.getElementById('modal-justificativa').classList.remove('open');
    _justAnotId = null;
    // Reset modal to editable state for next use
    document.getElementById('just-texto').disabled = false;
    document.getElementById('btn-just-rascunho').style.display = 'inline-flex';
    document.getElementById('btn-just-enviar').style.display   = 'inline-flex';
    document.getElementById('just-enviada-aviso').style.display = 'none';
    document.getElementById('just-anexos-wrap').style.display  = 'block';
    const vb = document.getElementById('just-veredito-block');
    if (vb) vb.style.display = 'none';
  }

  async function submitJustificativa(enviar) {
    if (!_justAnotId) return;
    const texto = document.getElementById('just-texto').value.trim();
    if (!texto) { showAlert('just-error', 'Escreva sua justificativa antes de continuar.'); return; }

    if (enviar && !confirm('Ao enviar, a justificativa não poderá mais ser editada. Confirmar?')) return;

    const btnR = document.getElementById('btn-just-rascunho');
    const btnE = document.getElementById('btn-just-enviar');
    btnR.disabled = btnE.disabled = true;
    document.getElementById('just-error').className = 'alert error';

    try {
      const res = await fetch(`${API}/anotacoes/${_justAnotId}/justificativa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ texto, enviado: enviar }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('just-error', data.detail || 'Erro ao salvar.'); return; }

      showAlert('just-success', enviar ? 'Justificativa enviada para análise.' : 'Rascunho salvo com sucesso.', 'success');
      toast(enviar ? 'Justificativa enviada.' : 'Rascunho salvo.');

      // Atualiza mapa local
      if (window._cadeteAnotMap[_justAnotId]) {
        window._cadeteAnotMap[_justAnotId].justificativa        = texto;
        window._cadeteAnotMap[_justAnotId].justificativa_enviada = enviar;
      }

      if (enviar) {
        // Bloquear edição sem fechar
        document.getElementById('just-texto').disabled = true;
        document.getElementById('btn-just-rascunho').style.display = 'none';
        document.getElementById('btn-just-enviar').style.display   = 'none';
        document.getElementById('just-enviada-aviso').style.display = 'block';
      }

      loadJustificar();
    } catch { showAlert('just-error', 'Erro de conexão.'); }
    finally { btnR.disabled = btnE.disabled = false; }
  }

  // ══════════════════════════════════════════════════
  // SHARED — MEUS VEREDITOS
  // ══════════════════════════════════════════════════
  // Cache completo de vereditos do cadete (carregado uma vez, paginado client-side)
  window._meusVereditos = [];
  // MEUS_VER_LIMIT follows global LIMIT

  let _meusVerAnoInit = false;
  async function loadMeusVereditos(page = 1) {
    const tbody = document.getElementById('tbody-meus-vereditos');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';

    if (!_meusVerAnoInit) {
      _meusVerAnoInit = true;
      const anoSel = document.getElementById('filter-meus-ver-ano');
      if (anoSel && anoSel.options.length <= 1) {
        const y = new Date().getFullYear();
        anoSel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Todos' }));
        for (let yr = y - 2; yr <= y + 1; yr++) {
          const o = document.createElement('option');
          o.value = yr; o.textContent = yr;
          if (yr === y) o.selected = true;
          anoSel.appendChild(o);
        }
      }
    }

    const resultadoLabel = PUNICAO_LABELS;
    const resultadoStyle = {
      justificada:             'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);',
      perda_de_ponto:          'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);',
      pernoite:                'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
      'licença_nao_concedida': 'color:#ed1e24;border-color:rgba(180,10,10,.25);background:rgba(237,30,36,.08);',
      recolher:                'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
      servico_extra:           'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
      pre_alvorada:            'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
      trabalhos_e_estudos:     'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
    };

    const mvResultado = document.getElementById('filter-meus-ver-resultado')?.value || '';
    const mvMes       = document.getElementById('filter-meus-ver-mes')?.value || '';
    const mvAno       = document.getElementById('filter-meus-ver-ano')?.value || '';
    const mvParams    = new URLSearchParams({ page, limit: LIMIT });
    if (mvResultado) mvParams.set('resultado', mvResultado);
    if (mvMes)       mvParams.set('mes',       mvMes);
    if (mvAno)       mvParams.set('ano',       mvAno);
    applySort(mvParams, 'meus_vereditos');

    try {
      const res = await fetch(`${API}/cadete/anotacoes/vereditos?${mvParams}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      document.getElementById('meta-meus-vereditos').textContent =
        `${json.total} anotação(ões) com veredito registrado`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM VEREDITO REGISTRADO</td></tr>';
        document.getElementById('pag-info-meus-vereditos').textContent = '0 registros';
        document.getElementById('pag-btns-meus-vereditos').innerHTML = '';
        return;
      }

      window._meusVeredMap = {};
      json.data.forEach(a => { window._meusVeredMap[a.id] = a; });

      tbody.innerHTML = json.data.map(a => {
        const justPreview = a.justificativa ? a.justificativa.substring(0, 50) + (a.justificativa.length > 50 ? '…' : '') : '—';
        const obsPreview  = a.veredito_observacao ? a.veredito_observacao.substring(0, 50) + (a.veredito_observacao.length > 50 ? '…' : '') : '—';
        const recursoCell = a.recurso_status === 'pendente'
          ? `<span class="pill" style="color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);">Pendente</span>`
          : a.recurso_status === 'despachado'
          ? `<span class="pill" style="color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);">Despachado</span>`
          : a.recurso_status === 'deferido'
          ? `<span class="pill" style="color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);">Deferido</span>`
          : a.recurso_status === 'indeferido'
          ? `<span class="pill" style="color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);">Indeferido</span>`
          : a.veredito === 'perda_de_ponto' && a.veredito_decidido_em && ((Date.now() - new Date(a.veredito_decidido_em)) / 3600000) <= 48
          ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px;" onclick="event.stopPropagation();openRecursoModal(${a.id})">Requerer</button>`
          : '—';
        return `
        <tr style="cursor:pointer;" onclick="openMeuVeredito(${a.id})">
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span></td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${a.descricao ? a.descricao.substring(0,50)+(a.descricao.length>50?'…':'') : '<span style="font-size:10px;color:var(--muted);">sem descrição</span>'}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${justPreview}</td>
          <td><span class="pill" style="${resultadoStyle[a.veredito]||''}">${resultadoLabel[a.veredito]||a.veredito}</span></td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${obsPreview}</td>
          <td class="td-mono">${fmtDate(a.veredito_decidido_em)}</td>
          <td onclick="event.stopPropagation()">${recursoCell}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-meus-vereditos', 'pag-info-meus-vereditos',
        { page, total: json.total, data: json.data }, loadMeusVereditos);

    } catch {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }


  // ══════════════════════════════════════════════════
  // AUXILIAR — USUÁRIOS (same logic as coordenador)
  // ══════════════════════════════════════════════════
  window._auxUsuarios = [];

  async function loadAuxUsuarios() {
    document.getElementById('aux-usuarios-container').innerHTML =
      '<div class="card"><table><tbody class="loading-row"><tr><td>CARREGANDO...</td></tr></tbody></table></div>';

    try {
      const res = await fetch(`${API}/coordenador/usuarios${qsCurso()}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      window._auxUsuarios = await res.json();
      window._usersMap = {};
      window._auxUsuarios.forEach(u => { window._usersMap[u.id] = { username: u.username, numero_geral: u.numero_geral }; });
      renderAuxUsuarios();
      // repopulate cadete dropdowns for aux-vereditos
      populateAuxCadeteSd();
    } catch {
      document.getElementById('aux-usuarios-container').innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠</div><div class="empty-state-text">ERRO AO CARREGAR</div></div>';
    }
  }

  function renderAuxUsuarios() {
    const filterNome     = document.getElementById('aux-filter-nome')?.value?.toLowerCase() ?? '';
    const filterRole     = document.getElementById('aux-filter-role')?.value ?? '';
    const filterTurmaPelAux = document.getElementById('aux-filter-turma-pel')?.value ?? '';

    const lista = window._auxUsuarios.filter(u => {
      const nomeOk = !filterNome || u.username.toLowerCase().includes(filterNome);
      const roleOk = !filterRole || u.role === filterRole;
      const tpKey  = u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : '';
      const tpOk   = !filterTurmaPelAux || tpKey === filterTurmaPelAux;
      return nomeOk && roleOk && tpOk;
    });

    // Populate turma+pel select if empty
    const tpSelectAux = document.getElementById('aux-filter-turma-pel');
    if (tpSelectAux && tpSelectAux.options.length <= 1) {
      const keys = [...new Set(window._auxUsuarios.map(u =>
        u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : null
      ).filter(Boolean))].sort((a, b) => {
        const [ta, pa=''] = a.split('-'), [tb, pb=''] = b.split('-');
        return (parseInt(ta)||9999) - (parseInt(tb)||9999) || pa.localeCompare(pb);
      });
      keys.forEach(k => {
        const [t, p] = k.split('-');
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${t}${p ?? ''}`;
        tpSelectAux.appendChild(opt);
      });
    }

    document.getElementById('aux-usuarios-meta').textContent =
      `${lista.length} usuário(s) exibido(s) de ${window._auxUsuarios.length} total`;

    if (!lista.length) {
      document.getElementById('aux-usuarios-container').innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">◎</div><div class="empty-state-text">NENHUM USUÁRIO ENCONTRADO</div></div>';
      return;
    }

    document.getElementById('aux-usuarios-container').innerHTML = renderGruposUsuarios(lista, (u) => renderUsuarioRow(u, 'aux'));
  }

  async function auxConfirmChangeRole(userId, username, newRole, selectEl) {
    const usuario = window._auxUsuarios.find(u => u.id === userId);
    if (!usuario || usuario.role === newRole) return;
    const statusEl = document.getElementById(`aux-role-status-${userId}`);
    statusEl.textContent = 'salvando...'; statusEl.style.color = 'var(--muted)';
    selectEl.disabled = true;
    try {
      const res = await fetch(`${API}/coordenador/usuarios/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ numero_geral: usuario.numero_geral, new_role: newRole, curso_id: cursoAtivoId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        selectEl.value = usuario.role;
        statusEl.textContent = '✗ erro'; statusEl.style.color = 'var(--danger)';
        toast(data.detail || 'Erro.', 'error');
      } else {
        usuario.role = newRole;
        statusEl.textContent = '✓ salvo'; statusEl.style.color = 'var(--success)';
        toast(`Função de ${username} alterada para ${roleLabel(newRole)}.`);
        setTimeout(() => { statusEl.textContent = ''; renderAuxUsuarios(); }, 1500);
      }
    } catch {
      selectEl.value = usuario.role;
      statusEl.textContent = '✗ falha'; statusEl.style.color = 'var(--danger)';
      toast('Erro de conexão.', 'error');
    } finally { selectEl.disabled = false; }
  }

  async function auxConfirmChangeSubRole(userId, username, newSubRole, selectEl) {
    const usuario = window._auxUsuarios.find(u => u.id === userId);
    if (!usuario || (usuario.sub_role ?? '') === newSubRole) return;
    const statusEl = document.getElementById(`aux-sub-role-status-${userId}`);
    statusEl.textContent = 'salvando...'; statusEl.style.color = 'var(--muted)';
    selectEl.disabled = true;
    try {
      const res = await fetch(`${API}/coordenador/usuarios/sub_role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ numero_geral: usuario.numero_geral, new_sub_role: newSubRole || null, curso_id: cursoAtivoId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        selectEl.value = usuario.sub_role ?? '';
        statusEl.textContent = '✗ erro'; statusEl.style.color = 'var(--danger)';
        toast(data.detail || 'Erro.', 'error');
      } else {
        usuario.sub_role = newSubRole || null;
        statusEl.textContent = '✓ salvo'; statusEl.style.color = 'var(--success)';
        toast(`Sub-função de ${username} alterada para ${newSubRole || '—'}.`);
        setTimeout(() => { statusEl.textContent = ''; renderAuxUsuarios(); }, 1500);
      }
    } catch {
      selectEl.value = usuario.sub_role ?? '';
      statusEl.textContent = '✗ falha'; statusEl.style.color = 'var(--danger)';
      toast('Erro de conexão.', 'error');
    } finally { selectEl.disabled = false; }
  }

  // ══════════════════════════════════════════════════
  // ADMIN GERAL — COORDENADORES
  // ══════════════════════════════════════════════════
  async function initAdminCoordenadores() {
    await _loadAdminCursosSds();
    await loadAdminCursos(1);
    await loadAdminCoordenadores(1);
  }

  function _noop() {}

  // Busca todos os cursos (sem paginação) para popular os dropdowns e o filtro de ano.
  async function _loadAdminCursosSds() {
    try {
      const res = await fetch(`${API}/admin/cursos?limit=9999`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const json = await res.json();
      const cursos = json.data;

      const addList = document.getElementById('sd-admin-add-curso-list');
      if (addList) {
        addList.innerHTML = cursos.map(c => {
          const label = c.nome + (c.sigla ? ` (${c.sigla})` : '');
          return `<div class="sd-option" data-value="${c.id}" data-search="${label.toLowerCase()}"
            onclick="selectSdOption('sd-admin-add-curso', ${c.id}, '${label.replace(/'/g, "\\'")}', _noop)">
            <span class="sd-option-label">${label}</span>
          </div>`;
        }).join('');
      }

      const filtroList = document.getElementById('sd-admin-filtro-curso-list');
      if (filtroList) {
        filtroList.innerHTML =
          `<div class="sd-option" data-value="" data-search="todos os cursos"
            onclick="selectSdOption('sd-admin-filtro-curso', '', 'Todos os cursos', loadAdminCoordenadores)">
            <span class="sd-option-label">Todos os cursos</span>
          </div>` +
          cursos.map(c => {
            const label = c.nome + (c.sigla ? ` (${c.sigla})` : '');
            return `<div class="sd-option" data-value="${c.id}" data-search="${label.toLowerCase()}"
              onclick="selectSdOption('sd-admin-filtro-curso', ${c.id}, '${label.replace(/'/g, "\\'")}', loadAdminCoordenadores)">
              <span class="sd-option-label">${label}</span>
            </div>`;
          }).join('');
      }

      const anoSel = document.getElementById('admin-filtro-ano');
      if (anoSel) {
        const anos = [...new Set(cursos.map(c => c.ano).filter(Boolean))].sort((a, b) => b - a);
        const cur = anoSel.value;
        anoSel.innerHTML = '<option value="">Todos</option>' +
          anos.map(a => `<option value="${a}"${String(a) === cur ? ' selected' : ''}>${a}</option>`).join('');
      }
    } catch { toast('Erro ao carregar cursos.', 'error'); }
  }

  async function loadAdminCursos(page = 1) {
    try {
      const ano = document.getElementById('admin-filtro-ano')?.value || '';
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (ano) params.set('ano', ano);

      const res = await fetch(`${API}/admin/cursos?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const json = await res.json();

      const tipoLabel = { formacao: 'Formação', especializacao: 'Especialização', habilitacao: 'Habilitação' };
      $('admin-cursos-tbody').innerHTML = json.data.length
        ? json.data.map(c => {
            const coordBadge = c.coordenadores
              ? `<span style="color:var(--success-text,#166534);font-weight:600;">✔ ${c.coordenadores}</span>`
              : `<span style="color:var(--muted);">— sem coordenador</span>`;
            return `<tr>
              <td>${c.nome}</td>
              <td class="td-mono">${c.sigla ?? '—'}</td>
              <td>${tipoLabel[c.tipo] ?? c.tipo}</td>
              <td class="td-mono">${c.ano ?? '—'}</td>
              <td>${coordBadge}</td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="5" style="text-align:center;color:var(--muted);">Nenhum curso encontrado.</td></tr>`;

      renderPagBar('pag-btns-cursos', 'pag-info-cursos', { page, total: json.total, data: json.data }, loadAdminCursos);
    } catch { toast('Erro ao carregar cursos.', 'error'); }
  }

  async function criarCursoAdmin() {
    const nome   = $('admin-curso-nome').value.trim();
    const sigla  = $('admin-curso-sigla').value.trim();
    const tipo   = $('admin-curso-tipo').value;
    const anoRaw = $('admin-curso-ano').value.trim();
    const ano    = anoRaw ? Number(anoRaw) : null;
    hideAlert('admin-curso-alert');
    if (!nome) { showAlert('admin-curso-alert', 'Informe o nome do curso.'); return; }
    try {
      const res = await fetch(`${API}/admin/cursos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ nome, sigla: sigla || null, tipo, ano }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('admin-curso-alert', data.detail || 'Erro ao criar curso.'); return; }
      $('admin-curso-nome').value = '';
      $('admin-curso-sigla').value = '';
      $('admin-curso-ano').value = '';
      toast(`Curso '${data.nome}' criado.`);
      await _loadAdminCursosSds();
      await loadAdminCursos(1);
    } catch { showAlert('admin-curso-alert', 'Erro de conexão.'); }
  }

  async function loadAdminCoordenadores(page = 1) {
    try {
      const cursoId = getSdValue('sd-admin-filtro-curso');
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (cursoId) params.set('curso_id', cursoId);

      const res = await fetch(`${API}/admin/coordenadores?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const json = await res.json();

      $('admin-coordenadores-tbody').innerHTML = json.data.length
        ? json.data.map(r => `
            <tr>
              <td>${r.curso_nome}</td>
              <td>${r.username}</td>
              <td class="td-mono">${r.cpf ?? '—'}</td>
              <td><button class="btn-edit-infracao" onclick="removerCoordenadorAdmin(${r.id})" title="Remover">✕</button></td>
            </tr>`).join('')
        : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Nenhum coordenador cadastrado.</td></tr>`;

      renderPagBar('pag-btns-coordenadores', 'pag-info-coordenadores', { page, total: json.total, data: json.data }, loadAdminCoordenadores);
    } catch { toast('Erro ao carregar coordenadores.', 'error'); }
  }

  async function adicionarCoordenadorAdmin() {
    const cursoId = getSdValue('sd-admin-add-curso');
    const cpf = $('admin-add-cpf').value.trim();
    hideAlert('admin-add-alert');
    if (!cursoId) { showAlert('admin-add-alert', 'Selecione um curso.'); return; }
    if (!cpf)     { showAlert('admin-add-alert', 'Informe o CPF.'); return; }
    try {
      const res = await fetch(`${API}/admin/coordenadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ cpf, curso_id: cursoId }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('admin-add-alert', data.detail || 'Erro ao adicionar.'); return; }
      $('admin-add-cpf').value = '';
      toast(data.message || 'Coordenador adicionado.');
      await _loadAdminCursosSds();
      await loadAdminCursos(1);
      await loadAdminCoordenadores(1);
    } catch { showAlert('admin-add-alert', 'Erro de conexão.'); }
  }

  async function removerCoordenadorAdmin(roleId) {
    if (!confirm('Remover este coordenador?')) return;
    try {
      const res = await fetch(`${API}/admin/coordenadores/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao remover.', 'error'); return; }
      toast(data.message || 'Removido.');
      await _loadAdminCursosSds();
      await loadAdminCursos(1);
      loadAdminCoordenadores(1);
    } catch { toast('Erro de conexão.', 'error'); }
  }

  // ══════════════════════════════════════════════════
  // STAFF DO CURSO (exclusivo do coordenador) — designa auxiliar,
  // comandante_de_pelotao, comandante_de_companhia, lider_corpo_alunos
  // ══════════════════════════════════════════════════
  function onStaffRoleChange() {
    const isComandante = ['comandante_de_pelotao', 'comandante_de_companhia'].includes($('staff-add-role').value);
    $('staff-add-turma-wrap').style.display = isComandante ? '' : 'none';
    $('staff-add-pel-wrap').style.display   = isComandante ? '' : 'none';
    if (isComandante) loadStaffTurmas();
  }

  function onStaffModoChange() {
    const porCpf = $('staff-add-modo').value === 'cpf';
    $('staff-add-numero-wrap').style.display = porCpf ? 'none' : '';
    $('staff-add-cpf-wrap').style.display    = porCpf ? '' : 'none';
  }

  async function initStaffCurso() {
    onStaffRoleChange();
    onStaffModoChange();
    await loadStaffCurso();
  }

  async function loadStaffTurmas() {
    try {
      const res = await fetch(`${API}/coordenador/turmas-pelotoes${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const rows = await res.json();
      window._staffTurmasPel = rows;
      const turmas = [...new Map(rows.map(r => [r.turma_id, r.nome])).entries()];
      $('staff-add-turma').innerHTML = turmas.map(([id, nome]) => `<option value="${id}">${nome}</option>`).join('');
      onStaffTurmaChange();
    } catch { toast('Erro ao carregar turmas.', 'error'); }
  }

  function onStaffTurmaChange() {
    const turmaId = $('staff-add-turma').value;
    const pels = (window._staffTurmasPel || []).filter(r => r.turma_id === turmaId).map(r => r.pel);
    $('staff-add-pel').innerHTML = pels.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  async function loadStaffCurso() {
    try {
      const res = await fetch(`${API}/coordenador/staff${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const rows = await res.json();
      $('staff-curso-tbody').innerHTML = rows.length
        ? rows.map(r => `
            <tr>
              <td>${roleLabel(r.role)}</td>
              <td>${r.username}</td>
              <td class="td-mono">${r.turma_id ? `${r.turma_id} ${r.pel ?? ''}` : '—'}</td>
              <td><button class="btn-edit-infracao" onclick="removerStaff(${r.id})" title="Remover">✕</button></td>
            </tr>`).join('')
        : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Nenhum staff cadastrado.</td></tr>`;
    } catch { toast('Erro ao carregar staff.', 'error'); }
  }

  async function adicionarStaff() {
    const role = $('staff-add-role').value;
    const porCpf = $('staff-add-modo').value === 'cpf';
    hideAlert('staff-add-alert');

    const body = { role, curso_id: cursoAtivoId() };
    if (porCpf) {
      body.cpf = $('staff-add-cpf').value.trim();
      if (!body.cpf) { showAlert('staff-add-alert', 'Informe o CPF.'); return; }
    } else {
      const numero = Number($('staff-add-numero').value);
      if (!numero) { showAlert('staff-add-alert', 'Informe o número geral.'); return; }
      body.numero_geral = numero;
    }
    if (['comandante_de_pelotao', 'comandante_de_companhia'].includes(role)) {
      body.turma_id = $('staff-add-turma').value;
      body.pel      = $('staff-add-pel').value;
      if (!body.turma_id || !body.pel) { showAlert('staff-add-alert', 'Selecione turma e pelotão.'); return; }
    }

    try {
      const res = await fetch(`${API}/coordenador/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('staff-add-alert', data.detail || 'Erro ao adicionar.'); return; }
      $('staff-add-numero').value = '';
      $('staff-add-cpf').value = '';
      toast(data.message || 'Staff adicionado.');
      loadStaffCurso();
    } catch { showAlert('staff-add-alert', 'Erro de conexão.'); }
  }

  async function removerStaff(roleId) {
    if (!confirm('Remover este membro da staff?')) return;
    try {
      const res = await fetch(`${API}/coordenador/staff/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao remover.', 'error'); return; }
      toast(data.message || 'Removido.');
      loadStaffCurso();
    } catch { toast('Erro de conexão.', 'error'); }
  }

  // ══════════════════════════════════════════════════
  // TURMAS DO CURSO (coordenador e ensino)
  // ══════════════════════════════════════════════════

  function _renderTurmasTabela(rows, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = rows.length
      ? rows.map(r => `
          <tr>
            <td class="td-mono">${r.id}</td>
            <td>${r.nome}</td>
            <td class="td-mono">${r.data ?? '—'}</td>
            <td style="text-align:center;">${r.antiguidade ?? '—'}</td>
            <td style="text-align:center;">${r.total_matriculados ?? 0}</td>
            <td style="text-align:center;">${r.total_pelotoes ?? 0}</td>
          </tr>`).join('')
      : `<tr><td colspan="6" style="text-align:center;color:var(--muted);">Nenhuma turma cadastrada.</td></tr>`;
  }

  async function loadCoordTurmas() {
    try {
      const res = await fetch(`${API}/coordenador/turmas${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const rows = await res.json();
      _renderTurmasTabela(rows, 'coord-turmas-tbody');
      // populate turma select for matricula
      _populateMatriculaTurmaSelect(rows, 'mat-turma');
    } catch { toast('Erro ao carregar turmas.', 'error'); }
  }

  async function loadEnsinoTurmas() {
    try {
      const res = await fetch(`${API}/coordenador/turmas${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const rows = await res.json();
      _renderTurmasTabela(rows, 'ensino-turmas-tbody');
      _populateMatriculaTurmaSelect(rows, 'emat-turma');
    } catch { toast('Erro ao carregar turmas.', 'error'); }
  }

  function _populateMatriculaTurmaSelect(rows, selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = rows.length
      ? rows.map(r => `<option value="${r.id}">${r.id} — ${r.nome}</option>`).join('')
      : `<option value="">Nenhuma turma disponível</option>`;
  }

  async function _criarTurmaImpl(idInputId, nomeInputId, dataInputId, antiguidadeInputId, alertId, tbodyId, turmaSelectId) {
    hideAlert(alertId);
    const id         = document.getElementById(idInputId)?.value.trim().toUpperCase();
    const nome       = document.getElementById(nomeInputId)?.value.trim();
    const data       = document.getElementById(dataInputId)?.value || null;
    const ant        = document.getElementById(antiguidadeInputId)?.value;
    if (!id)   { showAlert(alertId, 'Informe o ID da turma.'); return; }
    if (!nome) { showAlert(alertId, 'Informe o nome da turma.'); return; }
    try {
      const body = { id, nome, curso_id: cursoAtivoId() };
      if (data) body.data = data;
      if (ant)  body.antiguidade = Number(ant);
      const res = await fetch(`${API}/coordenador/turmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { showAlert(alertId, json.detail || 'Erro ao criar turma.'); return; }
      document.getElementById(idInputId).value   = '';
      document.getElementById(nomeInputId).value = '';
      if (antiguidadeInputId) document.getElementById(antiguidadeInputId).value = '';
      toast(`Turma ${json.id} criada com sucesso.`);
      // reload list
      const listRes = await fetch(`${API}/coordenador/turmas${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (listRes.ok) {
        const rows = await listRes.json();
        _renderTurmasTabela(rows, tbodyId);
        _populateMatriculaTurmaSelect(rows, turmaSelectId);
      }
    } catch { showAlert(alertId, 'Erro de conexão.'); }
  }

  function criarTurma()       { _criarTurmaImpl('ct-id', 'ct-nome', 'ct-data', 'ct-antiguidade', 'ct-alert', 'coord-turmas-tbody', 'mat-turma'); }
  function criarEnsinoTurma() { _criarTurmaImpl('et-id', 'et-nome', 'et-data', 'et-antiguidade', 'et-alert', 'ensino-turmas-tbody', 'emat-turma'); }

  // Preenche select de turmas ao entrar na seção de matrícula (sem recarregar a tabela)
  async function _loadMatriculaTurmasSelect(selectId) {
    try {
      const res = await fetch(`${API}/coordenador/turmas${qsCurso('?')}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) _populateMatriculaTurmaSelect(await res.json(), selectId);
    } catch {}
  }

  function loadCoordMatriculaTurmas()  { _loadMatriculaTurmasSelect('mat-turma'); }
  function loadEnsinoMatriculaTurmas() { _loadMatriculaTurmasSelect('emat-turma'); }

  async function _matricularImpl(cpfId, turmaId, pelId, numGeralId, alertId) {
    hideAlert(alertId);
    const cpf      = document.getElementById(cpfId)?.value.trim();
    const turma_id = document.getElementById(turmaId)?.value;
    const pel      = (document.getElementById(pelId)?.value || 'A').trim().toUpperCase();
    const ng       = document.getElementById(numGeralId)?.value;
    if (!cpf)      { showAlert(alertId, 'Informe o CPF.'); return; }
    if (!turma_id) { showAlert(alertId, 'Selecione a turma.'); return; }
    try {
      const body = { cpf, turma_id, pel, curso_id: cursoAtivoId() };
      if (ng) body.numero_geral = Number(ng);
      const res = await fetch(`${API}/coordenador/matriculas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { showAlert(alertId, json.detail || 'Erro ao matricular.'); return; }
      document.getElementById(cpfId).value = '';
      toast(json.message || 'Aluno matriculado com sucesso.');
    } catch { showAlert(alertId, 'Erro de conexão.'); }
  }

  function matricularAluno()      { _matricularImpl('mat-cpf', 'mat-turma', 'mat-pel', 'mat-numero-geral', 'mat-alert'); }
  function matricularEnsinoAluno(){ _matricularImpl('emat-cpf', 'emat-turma', 'emat-pel', 'emat-numero-geral', 'emat-alert'); }

  // ══════════════════════════════════════════════════
  // TIPOS DE DISCIPLINA (ensino)
  // ══════════════════════════════════════════════════

  async function loadEnsinoTiposDisciplina() {
    try {
      const res = await fetch(`${API}/coordenador/disciplina_types${qsCurso('?')}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const rows = await res.json();
      $('etd-tbody').innerHTML = rows.length
        ? rows.map(r => `
            <tr>
              <td>${r.nome}</td>
              <td style="text-align:center;">${r.semestre ?? '—'}</td>
              <td style="text-align:center;">${r.horas_aula ?? '—'}</td>
              <td style="text-align:center;">${r.peso != null ? Number(r.peso) : '—'}</td>
            </tr>`).join('')
        : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Nenhum tipo cadastrado.</td></tr>`;
    } catch { toast('Erro ao carregar tipos de disciplina.', 'error'); }
  }

  async function criarTipoDisciplina() {
    hideAlert('etd-alert');
    const nome    = $('etd-nome')?.value.trim().toUpperCase();
    const semestre = $('etd-semestre')?.value;
    const horas   = $('etd-horas')?.value;
    const peso    = $('etd-peso')?.value;
    if (!nome) { showAlert('etd-alert', 'Informe o nome da disciplina.'); return; }
    try {
      const body = { nome, curso_id: cursoAtivoId() };
      if (semestre) body.semestre   = Number(semestre);
      if (horas)    body.horas_aula = Number(horas);
      if (peso)     body.peso       = Number(peso);
      const res = await fetch(`${API}/coordenador/disciplina_types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { showAlert('etd-alert', json.detail || 'Erro ao cadastrar.'); return; }
      $('etd-nome').value = '';
      $('etd-semestre').value = '';
      $('etd-horas').value = '';
      $('etd-peso').value = '';
      toast(json.message || 'Tipo cadastrado com sucesso.');
      loadEnsinoTiposDisciplina();
    } catch { showAlert('etd-alert', 'Erro de conexão.'); }
  }

  // ══════════════════════════════════════════════════
  // AUXILIAR — COM VEREDITO (same as coordenador)
  // ══════════════════════════════════════════════════
  function populateAuxCadeteSd() {
    const listEl = document.getElementById('sd-cadete-aux-veredito-list');
    const trigEl = document.getElementById('sd-cadete-aux-veredito-trigger');
    if (!listEl) return;
    if (trigEl) trigEl.dataset.placeholder = 'Todos os cadetes';
    listEl.innerHTML = window._auxUsuarios.map(u => {
      const label  = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
      const tpKey  = u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : '';
      const tpLbl  = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
      return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}" data-tp="${tpKey}"
        onclick="selectSdOption('sd-cadete-aux-veredito', ${u.id}, '${label.replace(/'/g, String.fromCharCode(39))}', loadAuxVereditos)">
        <span class="sd-option-label">${label}</span>
        <span class="sd-option-pts" style="color:var(--muted);">${tpLbl}</span>
      </div>`;
    }).join('');

    // Populate and wire tp-filter-aux-veredito select
    const tpSelAux = document.getElementById('tp-filter-aux-veredito');
    if (tpSelAux && tpSelAux.options.length <= 1) {
      const keys = [...new Set(window._auxUsuarios.map(u =>
        u.turma != null ? `${u.turma}${u.pel ? '-' + u.pel : ''}` : null
      ).filter(Boolean))].sort((a, b) => {
        const [ta, pa=''] = a.split('-'), [tb, pb=''] = b.split('-');
        return (parseInt(ta)||9999) - (parseInt(tb)||9999) || pa.localeCompare(pb);
      });
      keys.forEach(k => {
        const [t, p] = k.split('-');
        const opt = document.createElement('option');
        opt.value = k; opt.textContent = `${t}${p ?? ''}`;
        tpSelAux.appendChild(opt);
      });
      tpSelAux.addEventListener('change', () => {
        const val = tpSelAux.value;
        listEl.querySelectorAll('.sd-option').forEach(o => {
          o.style.display = !val || o.dataset.tp === val ? '' : 'none';
        });
        loadAuxVereditos(1);
      });
    }
  }

  const AUX_VER_STATE = { page: 1, total: 0, data: [] };
  let _auxVerAnoInit = false;

  async function loadAuxVereditos(page = 1) {
    const tbody = document.getElementById('tbody-aux-veredito');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';

    if (!_auxVerAnoInit) {
      _auxVerAnoInit = true;
      const anoSel = document.getElementById('filter-aux-ver-ano');
      if (anoSel && anoSel.options.length <= 1) {
        const y = new Date().getFullYear();
        anoSel.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'Todos' }));
        for (let yr = y - 2; yr <= y + 1; yr++) {
          const o = document.createElement('option');
          o.value = yr; o.textContent = yr;
          if (yr === y) o.selected = true;
          anoSel.appendChild(o);
        }
      }
    }

    const resultado  = document.getElementById('aux-filter-resultado')?.value ?? '';
    const cadeteId   = getSdValue('sd-cadete-aux-veredito');
    const tpAVRaw = document.getElementById('tp-filter-aux-veredito')?.value ?? '';
    const [tpAVTurma, tpAVPel] = tpAVRaw ? tpAVRaw.split('-') : ['', ''];
    const avMes = document.getElementById('filter-aux-ver-mes')?.value || '';
    const avAno = document.getElementById('filter-aux-ver-ano')?.value || '';
    const params = new URLSearchParams({ veredito_status: 'dado', page, limit: LIMIT });
    if (resultado)  params.set('resultado', resultado);
    if (cadeteId)   params.set('cadete_id', cadeteId);
    if (tpAVTurma)  params.set('turma',     tpAVTurma);
    if (tpAVPel)    params.set('pel',       tpAVPel);
    if (avMes)      params.set('mes',       avMes);
    if (avAno)      params.set('ano',       avAno);
    if (cursoAtivoId() != null) params.set('curso_id', cursoAtivoId());
    applySort(params, 'aux_veredito');

    const resultadoLabel = PUNICAO_LABELS;
    const resultadoStyle = {
      justificada:             'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);',
      perda_de_ponto:          'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);',
      pernoite:                'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
      'licença_nao_concedida': 'color:#ed1e24;border-color:rgba(180,10,10,.25);background:rgba(237,30,36,.08);',
      recolher:                'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
      servico_extra:           'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
      pre_alvorada:            'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
      trabalhos_e_estudos:     'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
    };

    try {
      const res = await fetch(`${API}/coordenador/anotacoes?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      Object.assign(AUX_VER_STATE, { page, total: json.total, data: json.data });

      document.getElementById('aux-meta-veredito').textContent =
        `${json.total} anotação(ões) com veredito registrado`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO ENCONTRADA</td></tr>';
        document.getElementById('pag-info-aux-veredito').textContent = '0 registros';
        document.getElementById('pag-btns-aux-veredito').innerHTML = '';
        return;
      }

      tbody.innerHTML = json.data.map(a => {
        const preview = a.justificativa ? a.justificativa.substring(0,55)+(a.justificativa.length>55?'…':'') : '—';
        const obs     = a.veredito_observacao ? a.veredito_observacao.substring(0,50)+(a.veredito_observacao.length>50?'…':'') : '<span style="color:var(--muted);">—</span>';
        return `
        <tr style="cursor:pointer;" onclick="openAnotModal(${a.id}, 'veredito')">
          <td class="td-mono">#${a.id}</td>
          <td class="td-mono">${fmtDate(a.created_at)}</td>
          <td class="td-mono">${fmtDateOnly(a.data_do_fato)}</td>
          <td class="td-mono">${resolveUser(a.cad_anot)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(a.infracao)}<span style="margin-left:6px;font-size:10px;color:var(--danger);">${resolveDiscount(a.infracao)}</span>${a.descricao ? ' <span title="Possui descrição" style="font-size:10px;color:var(--accent);">📝</span>' : ''}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${preview}</td>
          <td class="td-mono">${fmtDate(a.veredito_decidido_em)}</td>
          <td><span class="pill" style="${resultadoStyle[a.veredito]||''}">${resultadoLabel[a.veredito]||a.veredito}</span></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${obs}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-aux-veredito', 'pag-info-aux-veredito', AUX_VER_STATE, loadAuxVereditos);

    } catch {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }


  // ══════════════════════════════════════════════════
  // ANEXOS
  // ══════════════════════════════════════════════════

  // ── Modal justificativa (cadete/dia_cfo) — upload + delete + view ──
  async function loadJustAnexos(anotId, canEdit) {
    const lista = document.getElementById('just-anexos-lista');
    const count = document.getElementById('just-anexos-count');
    const uploadRow = document.getElementById('just-upload-row');
    lista.innerHTML = '<div class="anexo-empty">carregando...</div>';

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexos`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const anexos = await res.json();

      count.textContent = `${anexos.length} arquivo(s)`;
      uploadRow.style.display = canEdit ? 'flex' : 'none';

      if (!anexos.length) {
        lista.innerHTML = '<div class="anexo-empty">Nenhum anexo</div>';
      } else {
        lista.innerHTML = anexos.map(a => `
          <div class="anexo-item" id="anexo-item-${a.id}">
            <span class="anexo-nome">📎 ${a.descricao}</span>
            <div class="anexo-actions">
              <a class="anexo-btn-ver" href="${a.url}" target="_blank" rel="noopener">Ver</a>
              ${canEdit ? `<button class="anexo-btn-del" onclick="deleteJustAnexo(${anotId}, ${a.id})" title="Remover">✕</button>` : ''}
            </div>
          </div>`).join('');
      }
    } catch {
      lista.innerHTML = '<div class="anexo-empty" style="color:var(--danger);">Erro ao carregar</div>';
    }
  }

  async function deleteJustAnexo(anotId, anexoId) {
    if (!confirm('Remover este anexo?')) return;
    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao remover.', 'error'); return; }
      toast('Anexo removido.');
      loadJustAnexos(anotId, true);
    } catch { toast('Erro de conexão.', 'error'); }
  }

  // File input change handler — wired in DOMContentLoaded
  async function handleJustFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    const anotId = _justAnotId;
    if (!anotId) return;

    const form = new FormData();
    form.append('file', file);
    e.target.value = ''; // reset input

    const uploadBtn = document.querySelector('#just-upload-row .anexo-upload-btn');
    uploadBtn.textContent = 'Enviando...';
    uploadBtn.disabled = true;

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao enviar.', 'error'); return; }
      toast('Anexo adicionado.');
      loadJustAnexos(anotId, true);
    } catch { toast('Erro de conexão.', 'error'); }
    finally { uploadBtn.textContent = '+ Adicionar Anexo'; uploadBtn.disabled = false; }
  }

  // ── Modal anotação coordenador — somente visualização ──
  async function loadManotAnexos(anotId) {
    const lista = document.getElementById('manot-anexos-lista');
    const count = document.getElementById('manot-anexos-count');
    lista.innerHTML = '<div class="anexo-empty">carregando...</div>';

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexos`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const anexos = await res.json();

      count.textContent = `${anexos.length} arquivo(s)`;

      if (!anexos.length) {
        lista.innerHTML = '<div class="anexo-empty">Nenhum anexo</div>';
      } else {
        lista.innerHTML = anexos.map(a => `
          <div class="anexo-item">
            <span class="anexo-nome">📎 ${a.descricao}</span>
            <div class="anexo-actions">
              <a class="anexo-btn-ver" href="${a.url}" target="_blank" rel="noopener">Ver</a>
            </div>
          </div>`).join('');
      }
    } catch {
      lista.innerHTML = '<div class="anexo-empty" style="color:var(--danger);">Erro ao carregar</div>';
    }
  }


  // ══════════════════════════════════════════════════
  // MOBILE — SIDEBAR DRAWER + BOTTOM NAV
  // ══════════════════════════════════════════════════
  function toggleSidebar() {
    const s = document.querySelector('.sidebar');
    const o = document.getElementById('sidebar-overlay');
    s.classList.toggle('open');
    o.classList.toggle('show');
  }
  function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }

  // Close sidebar when a nav item is clicked on mobile
  const _origShowSection2 = showSection;
  window.showSection = function(name) {
    _origShowSection2(name);
    if (window.innerWidth <= 640) closeSidebar();
    setActiveNav(null, name);
  };

  function setActiveNav(btnId, sectionName) {
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    // Map section name to bnav id
    const map = {
      'perfil':            'bnav-perfil',
      'anot-pendentes':    'bnav-pendentes',
      'anot-justificativa':'bnav-justificadas',
      'anot-justificadas': 'bnav-justificadas',
      'anot-veredito':     'bnav-justificadas',
      'usuarios':          'bnav-usuarios',
      'lancamento':        'bnav-lancamento',
      'minhas-anotacoes':  'bnav-minhas',
      'justificar':        'bnav-justificar',
      'meus-vereditos':    'bnav-vereditos',
      'aux-usuarios':      'bnav-aux-usuarios',
      'aux-vereditos':     'bnav-aux-vereditos',
    };
    const id = btnId || (sectionName && map[sectionName]);
    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }
  }

  function showMobileNav(role) {
    // Hide all role-specific items first
    document.querySelectorAll('.coord-nav, .diacfo-nav, .shared-nav, .aux-nav').forEach(el => {
      el.style.display = 'none';
    });
    if (role === 'coordenador') {
      document.querySelectorAll('.coord-nav').forEach(el => el.style.display = 'flex');
    }
    if (role === 'dia_cfo' || role === 'dia_curso' || role === 'xerife') {
      document.querySelectorAll('.nav-fo-plus').forEach(el => el.style.display = '');
      document.querySelectorAll('.diacfo-nav, .shared-nav').forEach(el => el.style.display = 'flex');
    }
    if (role === 'cadete' || role === 'aluno') {
      document.querySelectorAll('.shared-nav').forEach(el => el.style.display = 'flex');
    }
    if (role === 'auxiliar') {
      const optPend = document.getElementById('opt-elogio-pendente');
      if (optPend) optPend.style.display = '';
      document.querySelectorAll('.aux-nav').forEach(el => el.style.display = 'flex');
    }
  }

  // Sync badge-pendentes to bottom nav badge
  const _origLoadPend = loadPendentes;
  // Observe badge-pendentes changes
  const _pObserver = new MutationObserver(() => {
    const src = document.getElementById('badge-pendentes');
    const dst = document.getElementById('bnav-badge-pend');
    if (!src || !dst) return;
    dst.textContent = src.textContent;
    dst.style.display = src.style.display;
  });
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.getElementById('badge-pendentes');
    if (badge) _pObserver.observe(badge, { childList: true, attributes: true, attributeFilter: ['style'] });
  });


  // ══════════════════════════════════════════════════
  // EXPORTAR — DESCONTO DE PONTOS
  // ══════════════════════════════════════════════════
  let _expData = [];

  function initExportar() {
    // Populate turma select from _allUsuarios
    const turmaSelect = document.getElementById('exp-turma');
    if (turmaSelect && turmaSelect.options.length <= 1) {
      const turmas = [...new Set(
        (window._allUsuarios || []).map(u => u.turma).filter(t => t != null)
      )].sort((a, b) => a - b);
      turmas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = `Turma ${t}`;
        turmaSelect.appendChild(opt);
      });
    }

    // Populate ano select (current year ± 2)
    const anoSelect = document.getElementById('exp-ano');
    if (anoSelect && anoSelect.options.length <= 1) {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 1; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        anoSelect.appendChild(opt);
      }
    }

    // Set current month as default
    const mesSelect = document.getElementById('exp-mes');
    if (mesSelect && !mesSelect.value) {
      mesSelect.value = new Date().getMonth() + 1;
    }
  }

  async function gerarRelatorio() {
    const turma = document.getElementById('exp-turma').value;
    const mes   = document.getElementById('exp-mes').value;
    const ano   = document.getElementById('exp-ano').value;
    const errEl = document.getElementById('exp-error');
    errEl.className = 'alert error';

    if (!turma || !mes || !ano) {
      errEl.textContent = 'Selecione turma, mês e ano.';
      errEl.className = 'alert error show';
      return;
    }

    const mesesNomes = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    document.getElementById('tbody-exportar').innerHTML =
      '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';
    document.getElementById('exp-resultado').style.display = 'block';
    document.getElementById('btn-exportar-csv').style.display = 'none';
    document.getElementById('btn-exportar-nota').style.display = 'none';
    document.getElementById('btn-exportar-descontos').style.display = 'none';

    try {
      const res = await fetch(
        `${API}/exportar/desconto-pontos?turma=${turma}&mes=${mes}&ano=${ano}`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      );
      if (!res.ok) {
        const d = await res.json();
        errEl.textContent = d.detail || 'Erro ao gerar relatório.';
        errEl.className = 'alert error show';
        document.getElementById('exp-resultado').style.display = 'none';
        return;
      }

      const json = await res.json();
      _expData = json.data.filter(r => r.numero_geral != null);

      document.getElementById('exp-titulo').textContent =
        `Turma ${turma} — ${mesesNomes[mes]}/${ano}`;
      document.getElementById('exp-subtitulo').textContent =
        `${_expData.length} cadete(s)`;

      const totalDesc = _expData.reduce((s, r) => s + Number(r.desconto_total), 0);

      if (!_expData.length) {
        document.getElementById('tbody-exportar').innerHTML =
          '<tr><td colspan="6" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM RESULTADO</td></tr>';
        document.getElementById('exp-total-bar').textContent = '';
        return;
      }

      document.getElementById('tbody-exportar').innerHTML = _expData.map(r => {
        const desconto   = Number(r.desconto_total) || 0;
        const elogios    = Number(r.pontos_elogios) || 0;
        const notaFinal  = Math.min(10, Math.max(0, 8 - desconto + elogios));
        const nome = r.nome_completo || r.username;
        return `
        <tr>
          <td class="td-mono">${r.numero_geral ?? '—'}</td>
          <td class="td-name">${nome}</td>
          <td class="td-mono">${r.pel ?? '—'}</td>
          <td class="td-mono" style="text-align:center;font-weight:700;color:${desconto > 0 ? 'var(--danger)' : 'var(--muted)'};">-${desconto}</td>
          <td class="td-mono" style="text-align:center;font-weight:700;color:${elogios > 0 ? 'var(--success)' : 'var(--muted)'};">+${elogios}</td>
          <td class="td-mono" style="text-align:center;font-weight:700;color:${notaFinal >= 8 ? 'var(--success)' : notaFinal >= 6 ? 'var(--warn)' : 'var(--danger)'};">${notaFinal.toFixed(2)}</td>
        </tr>`;}).join('');

      // fix empty state colspan handled above

      const totalElogios = _expData.reduce((s, r) => s + (Number(r.pontos_elogios) || 0), 0);
      const mediaNotas   = _expData.length
        ? (_expData.reduce((s, r) => s + Math.min(10, Math.max(0, 8 - (Number(r.desconto_total)||0) + (Number(r.pontos_elogios)||0))), 0) / _expData.length).toFixed(2)
        : '—';
      document.getElementById('exp-total-bar').innerHTML =
        `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">
          Desconto total: <strong style="color:var(--danger);">-${totalDesc}</strong> &nbsp;|&nbsp;
          Pontos elogios: <strong style="color:var(--success);">+${totalElogios}</strong> &nbsp;|&nbsp;
          Média das notas: <strong style="color:var(--accent);">${mediaNotas}</strong>
        </span>`;

      document.getElementById('btn-exportar-csv').style.display = 'inline-flex';
      document.getElementById('btn-exportar-nota').style.display = 'inline-flex';
      document.getElementById('btn-exportar-descontos').style.display = 'inline-flex';

    } catch {
      errEl.textContent = 'Erro de conexão.';
      errEl.className = 'alert error show';
      document.getElementById('exp-resultado').style.display = 'none';
    }
  }

  function exportarCSV() {
    if (!_expData.length) return;

    const mesesNomes = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mes   = document.getElementById('exp-mes').value;
    const ano   = document.getElementById('exp-ano').value;
    const turma = document.getElementById('exp-turma').value;

    const header = ['Nº Geral','Nome de Guerra','Pel','Desconto (Anotações)','Pontos (Elogios)','Nota Final'];
    const rows = _expData.map(r => {
      const desconto  = Number(r.desconto_total) || 0;
      const elogios   = Number(r.pontos_elogios) || 0;
      const notaFinal = Math.min(10, Math.max(0, 8 - desconto + elogios)).toFixed(2);
      return [
        r.numero_geral ?? '',
        r.username,
        r.pel ?? '',
        desconto,
        elogios,
        notaFinal,
      ];
    });

    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `desconto_turma${turma}_${mesesNomes[mes]}_${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }


  // ── Anexos modal dia_cfo ──────────────────────────────────
  async function loadDiaCfoAnexos(anotId, canEdit) {
    const lista    = document.getElementById('diacfo-anexos-lista');
    const count    = document.getElementById('diacfo-anexos-count');
    const uploadRow = document.getElementById('diacfo-upload-row');

    uploadRow.style.display = 'none';

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexos`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const anexos = await res.json();

      count.textContent = `${anexos.length} arquivo(s)`;
      uploadRow.style.display = canEdit ? 'flex' : 'none';

      if (!anexos.length) {
        lista.innerHTML = '<div class="anexo-empty">Nenhum anexo</div>';
      } else {
        lista.innerHTML = anexos.map(a => `
          <div class="anexo-item" id="diacfo-anexo-${a.id}">
            <span class="anexo-nome">📎 ${a.descricao}</span>
            <div class="anexo-actions">
              <a class="anexo-btn-ver" href="${a.url}" target="_blank" rel="noopener">Ver</a>
              ${canEdit ? `<button class="anexo-btn-del" onclick="deleteDiaCfoAnexo(${anotId}, ${a.id})" title="Remover">✕</button>` : ''}
            </div>
          </div>`).join('');
      }
    } catch {
      lista.innerHTML = '<div class="anexo-empty" style="color:var(--danger);">Erro ao carregar</div>';
    }
  }

  async function deleteDiaCfoAnexo(anotId, anexoId) {
    if (!confirm('Remover este anexo?')) return;
    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao remover.', 'error'); return; }
      toast('Anexo removido.');
      const a = window._minhasAnotMap[anotId];
      loadDiaCfoAnexos(anotId, a ? a.status === 'pendente' : false);
    } catch { toast('Erro de conexão.', 'error'); }
  }

  async function handleDiaCfoFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    const anotId = _diacfoAnotId;
    if (!anotId) return;

    const form = new FormData();
    form.append('file', file);
    e.target.value = '';

    const btn = document.querySelector('#diacfo-upload-row .anexo-upload-btn');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/anotacoes/${anotId}/anexo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro ao enviar.', 'error'); return; }
      toast('Anexo adicionado.');
      loadDiaCfoAnexos(anotId, true);
    } catch { toast('Erro de conexão.', 'error'); }
    finally { btn.textContent = '+ Adicionar Anexo'; btn.disabled = false; }
  }


  // ── Detalhe veredito (cadete/dia_cfo) — abre modal-justificativa em modo leitura ──
  function openMeuVeredito(anotId) {
    const a = window._meusVeredMap && window._meusVeredMap[anotId];
    if (!a) return;

    const statusMap = { pendente: 'Pendente', aprovada: 'Aprovada', descartada: 'Descartada' };
    const statusCls = { pendente: 'pill-pendente', aprovada: 'pill-aprovada', descartada: 'pill-descartada' };
    const resultadoLabel = PUNICAO_LABELS;
    const resultadoStyle = PUNICAO_STYLES;

    // Populate modal-justificativa fields
    document.getElementById('just-modal-title').textContent  = `Anotação #${a.id} — Veredito`;
    document.getElementById('just-id').textContent           = `#${a.id}`;
    document.getElementById('just-status').innerHTML         = `<span class="pill ${statusCls[a.status]||''}">${statusMap[a.status]||a.status}</span>`;
    document.getElementById('just-infracao').textContent     = resolveInfracao(a.infracao);
    document.getElementById('just-data-fato').textContent    = fmtDateOnly(a.data_do_fato);
    document.getElementById('just-approved').textContent     = fmtDate(a.approved_at);
    document.getElementById('just-of-resp').textContent      = resolveOficial(a.of_resp);
    document.getElementById('just-cad-resp').textContent     = resolveUser(a.cad_resp);
    document.getElementById('just-descricao').textContent    = a.descricao || 'Sem descrição';
    document.getElementById('just-descricao').style.color    = a.descricao ? 'var(--text-dim)' : 'var(--muted)';
    document.getElementById('just-descricao').style.fontStyle = a.descricao ? 'normal' : 'italic';

    const u2 = window._currentUser;
    const infracao2 = resolveInfracao(a.infracao);
    const memorandoAprovadoEm = a.approved_at ? `Aprovado em: ${fmtDate(a.approved_at)}\n\n` : '';
    document.getElementById('just-memorando').textContent = u2
      ? `${memorandoAprovadoEm}Prezado(a) ${u2.cargo || 'CAD BM'} ${u2.numero_geral ?? ''} ${u2.username},\n\nDeveis justificar no prazo de 48h sua anotação por ${infracao2}.\n\nAtenciosamente,\nCoordenação CFO BM`
      : '';

    // Justificativa — read only
    document.getElementById('just-texto').value   = a.justificativa || '';
    document.getElementById('just-texto').disabled = true;
    document.getElementById('btn-just-rascunho').style.display = 'none';
    document.getElementById('btn-just-enviar').style.display   = 'none';
    document.getElementById('just-enviada-aviso').style.display = 'none';

    // Veredito block — inject after just-editor-wrap
    let veredEl = document.getElementById('just-veredito-block');
    if (!veredEl) {
      veredEl = document.createElement('div');
      veredEl.id = 'just-veredito-block';
      veredEl.style.cssText = 'margin-top:14px;background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--success);padding:13px 15px;';
      document.getElementById('just-editor-wrap').after(veredEl);
    }

    if (a.veredito) {
      veredEl.style.display = 'block';
      veredEl.style.borderLeftColor = resultadoStyle[a.veredito]?.split(':')[1]?.trim() || 'var(--success)';
      veredEl.innerHTML = `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;${resultadoStyle[a.veredito]||'color:var(--success)'}">Veredito do Coordenador</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Resultado</div>
            <div style="font-size:14px;font-weight:700;${resultadoStyle[a.veredito]||''}">${resultadoLabel[a.veredito]||a.veredito}</div>
          </div>
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Decidido em</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-dim);">${fmtDate(a.veredito_decidido_em)}</div>
          </div>
        </div>
        ${a.veredito_datas_cumprimento?.length ? `
        <div style="margin-top:10px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Datas de Cumprimento</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${a.veredito_datas_cumprimento.map(d => `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--warn);background:rgba(224,123,42,.1);border:1px solid rgba(224,123,42,.3);padding:3px 8px;border-radius:4px;">${fmtDateOnly(d)}</span>`).join('')}
          </div>
        </div>` : ''}
        ${a.veredito_observacao ? `
        <div style="margin-top:10px;">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">Observação</div>
          <p style="font-size:13px;line-height:1.6;color:var(--text-dim);">${a.veredito_observacao}</p>
        </div>` : ''}
      `;
    } else {
      veredEl.style.display = 'none';
    }

    document.getElementById('just-error').className   = 'alert error';
    document.getElementById('just-success').className = 'alert success';
    document.getElementById('just-anexos-wrap').style.display = 'none';

    document.getElementById('modal-justificativa').classList.add('open');
  }


  // ══════════════════════════════════════════════════
  // PENDENTES — SELEÇÃO EM LOTE
  // ══════════════════════════════════════════════════
  function getCheckedPendentes() {
    return [...document.querySelectorAll('.cb-pend:checked')].map(cb => Number(cb.value));
  }

  function onPendCheckChange() {
    const checked = getCheckedPendentes();
    const all     = document.querySelectorAll('.cb-pend');
    const cbAll   = document.getElementById('cb-all-pendentes');
    const bar     = document.getElementById('bulk-bar-pendentes');
    const count   = document.getElementById('bulk-count-pendentes');

    if (cbAll) {
      cbAll.indeterminate = checked.length > 0 && checked.length < all.length;
      cbAll.checked = checked.length === all.length && all.length > 0;
    }
    if (bar)   bar.classList.toggle('show', checked.length > 0);
    if (count) count.textContent = `${checked.length} selecionada(s)`;

    // Highlight rows
    document.querySelectorAll('.cb-pend').forEach(cb => {
      const row = document.getElementById(`pend-row-${cb.value}`);
      if (row) row.classList.toggle('selected', cb.checked);
    });
  }

  function toggleAllPendentes(cbAll) {
    document.querySelectorAll('.cb-pend').forEach(cb => { cb.checked = cbAll.checked; });
    onPendCheckChange();
  }

  function clearSelectionPendentes() {
    document.querySelectorAll('.cb-pend').forEach(cb => { cb.checked = false; });
    const cbAll = document.getElementById('cb-all-pendentes');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    const bar = document.getElementById('bulk-bar-pendentes');
    if (bar) bar.classList.remove('show');
  }

  async function bulkStatus(status) {
    const ids = getCheckedPendentes();
    if (!ids.length) return;

    const label = status === 'aprovada' ? 'aprovar' : 'descartar';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${ids.length} anotação(ões)?`)) return;

    const bar = document.getElementById('bulk-bar-pendentes');
    bar.querySelectorAll('button').forEach(b => { b.disabled = true; });

    let ok = 0, err = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`${API}/anotacoes/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify({ status }),
        });
        res.ok ? ok++ : err++;
      } catch { err++; }
    }

    bar.querySelectorAll('button').forEach(b => { b.disabled = false; });

    if (err === 0)      toast(`${ok} anotação(ões) ${status === 'aprovada' ? 'aprovadas' : 'descartadas'}.`);
    else if (ok === 0)  toast(`Todas as ${err} operações falharam.`, 'error');
    else                toast(`${ok} concluída(s), ${err} falha(s).`, 'error');

    loadPendentes(ANOT_STATE.pendentes.page);
  }


  // ══════════════════════════════════════════════════
  // ELOGIOS — estado
  // ══════════════════════════════════════════════════
  const ELOGIO_STATE = { page: 1, total: 0, data: [] };
  window._elogioTypesMap = {}; // id -> {description, pontos}
  const _elogioSel = { cadeteId: null, tipoId: null, tipoDesc: null, tipoPontos: null };

  // ── Carregar tipos de elogio ──────────────────────────────────
  async function loadElogioTypes() {
    if (Object.keys(window._elogioTypesMap).length) return;
    try {
      const res = await fetch(`${API}/elogio-types`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const tipos = await res.json();
      tipos.forEach(t => { window._elogioTypesMap[t.id] = { description: t.description, pontos: t.pontos }; });
    } catch {}
  }

  // ══════════════════════════════════════════════════
  // COORDENADOR — ELOGIOS PENDENTES
  // ══════════════════════════════════════════════════
  async function loadElogiosPendentes(page = 1) {
    const tbody = document.getElementById('tbody-elogios-pend');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8">CARREGANDO...</td></tr>';

    try {
      const cadeteIdEP = getSdValue('sd-cadete-elogios-pend');
      const paramsEP = new URLSearchParams({ page, limit: LIMIT });
      if (cadeteIdEP) paramsEP.set('cadete_id', cadeteIdEP);
      if (cursoAtivoId() != null) paramsEP.set('curso_id', cursoAtivoId());
      applySort(paramsEP, 'elogios_pend');
      const res = await fetch(`${API}/coordenador/elogios/pendentes?${paramsEP}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();

      ELOGIO_STATE.page = page; ELOGIO_STATE.total = json.total; ELOGIO_STATE.data = json.data;

      const badge = document.getElementById('badge-elogios-pend');
      if (badge) { badge.textContent = json.total; badge.style.display = json.total > 0 ? 'inline-block' : 'none'; }
      const badgeAux = document.getElementById('badge-elogios-pend-aux');
      if (badgeAux) { badgeAux.textContent = json.total; badgeAux.style.display = json.total > 0 ? 'inline-block' : 'none'; }

      document.getElementById('meta-elogios-pend').textContent =
        `${json.total} elogio(s) aguardando aprovação`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM ELOGIO PENDENTE</td></tr>';
        document.getElementById('pag-info-elogios-pend').textContent = '0 registros';
        document.getElementById('pag-btns-elogios-pend').innerHTML = '';
        return;
      }

      window._elogiosPendMap = {};
      json.data.forEach(e => { window._elogiosPendMap[e.id] = e; });
      clearSelectionElogios();

      tbody.innerHTML = json.data.map(e => {
        const motivoPreview = e.descricao_motivo
          ? e.descricao_motivo.substring(0, 55) + (e.descricao_motivo.length > 55 ? '…' : '')
          : '—';
        const dataEvento = e.data_evento ? fmtDateOnly(e.data_evento) : '—';
        return `
        <tr id="elogio-row-${e.id}" style="cursor:pointer;" onclick="openElogioModal(${e.id})">
          <td class="cb-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="cb-row cb-elogio" value="${e.id}" onchange="onElogioCheckChange()" />
          </td>
          <td class="td-mono">#${e.id}</td>
          <td class="td-mono">${fmtDate(e.created_at)}</td>
          <td class="td-mono">${dataEvento}</td>
          <td class="td-mono">${resolveUser(e.cadete_elogiado_id)}</td>
          <td class="td-mono" style="font-size:11px;color:var(--muted);">${e.responsavel_numero_geral != null ? e.responsavel_numero_geral + ' ' : ''}${e.responsavel_username || '—'}</td>
          <td style="font-size:12px;">${e.tipo_elogio}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700;">+${e.pontos}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${motivoPreview}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-elogios-pend', 'pag-info-elogios-pend', ELOGIO_STATE, loadElogiosPendentes);

    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  async function aprovarElogio(elogioId, status, btn) {
    btn.disabled = true; btn.textContent = '...';
    try {
      const res = await fetch(`${API}/elogios/${elogioId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.detail || 'Erro.', 'error'); btn.disabled = false; btn.textContent = status === 'aprovado' ? '✓' : '✕'; return; }
      toast(`Elogio ${status === 'aprovado' ? 'aprovado' : 'rejeitado'} com sucesso.`);
      loadElogiosPendentes(ELOGIO_STATE.page);
    } catch {
      toast('Erro de conexão.', 'error');
      btn.disabled = false;
    }
  }

  // ══════════════════════════════════════════════════
  // AUXILIAR — LANÇAR ELOGIO
  // ══════════════════════════════════════════════════
  async function initLancarElogio() {
    await loadElogioTypes();

    // Populate cadete dropdown
    const cadList = document.getElementById('sd-cadete-elogio-list');
    if (cadList && window._allUsuarios.length) {
      cadList.innerHTML = window._allUsuarios
        .slice()
        .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999))
        .map(u => {
          const label = u.numero_geral ? `${u.numero_geral} ${u.username}` : u.username;
          const turma = u.turma != null ? `${u.turma}${u.pel ?? ''}` : '';
          return `<div class="sd-option" data-value="${u.id}" data-search="${label.toLowerCase()}"
            onclick="selectElogioCadete(${u.id}, '${label.replace(/'/g, String.fromCharCode(39))}')">
            <span class="sd-option-label" style="flex:1;">${label}</span>
            <span style="font-size:10px;color:var(--muted);">${turma}</span>
          </div>`;
        }).join('');
    }

    // Populate tipo dropdown — dia_cfo/dia_curso e xerife só veem FO+
    const tipList = document.getElementById('sd-tipo-elogio-list');
    const _role = window._currentUser?.role;
    const isRestrictedRole = _role === 'dia_cfo' || _role === 'dia_curso' || _role === 'xerife';
    if (tipList) {
      const entries = Object.entries(window._elogioTypesMap)
        .filter(([, t]) => !isRestrictedRole || t.description === 'FO+');
      tipList.innerHTML = entries.map(([id, t]) => `
        <div class="sd-option" data-value="${id}" data-search="${t.description.toLowerCase()}"
          onclick="selectElogioTipo(${id}, '${t.description.replace(/'/g, String.fromCharCode(39))}', ${t.pontos})">
          <span class="sd-option-label" style="flex:1;">${t.description}</span>
          <span style="font-size:10px;color:var(--success);font-weight:700;">+${t.pontos}</span>
        </div>`).join('');
      // Auto-selecionar FO+ se for role restrito e houver apenas um tipo
      if (isRestrictedRole && entries.length === 1) {
        const [id, t] = entries[0];
        selectElogioTipo(Number(id), t.description, t.pontos);
      }
    }

    // Set today as default date (local date, not UTC)
    const dateInput = document.getElementById('elogio-data-evento');
    if (dateInput && !dateInput.value) {
      const t = new Date();
      const iso = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
      dateInput.value = iso;
      const lbl = document.getElementById('dp-elogio-label');
      if (lbl) lbl.textContent = fmtDateOnly(iso);
    }
  }

  function selectElogioCadete(id, label) { adicionarCadeteElogio(id, label); }

  function selectElogioTipo(id, desc, pontos) {
    _elogioSel.tipoId    = id;
    _elogioSel.tipoDesc  = desc;
    _elogioSel.tipoPontos = pontos;
    const trig  = document.getElementById('sd-tipo-elogio-trigger');
    const badge = document.getElementById('elogio-pontos-badge');
    if (trig)  trig.textContent  = desc;
    if (badge) badge.textContent = `+${pontos} pts`;
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
  }

  function resetLancarElogio() {
    _elogioSel.cadeteId = null; _elogioSel.tipoId = null;
    _elogioCadetes = [];
    renderCadetesElogio();
    const trig1 = document.getElementById('sd-cadete-elogio-trigger');
    const trig2 = document.getElementById('sd-tipo-elogio-trigger');
    const badge = document.getElementById('elogio-pontos-badge');
    if (trig1) trig1.textContent = '— Selecione —';
    if (trig2) trig2.textContent = '— Selecione —';
    if (badge) badge.textContent = '';
    const descr = document.getElementById('elogio-descricao');
    if (descr) descr.value = '';
    document.getElementById('elogio-error').className   = 'alert error';
    document.getElementById('elogio-success').className = 'alert success';
  }

  async function lancarElogio() {
    const _ignored  = null; // cadetes via _elogioCadetes
    const tipoId     = _elogioSel.tipoId;
    const dataEvento = document.getElementById('elogio-data-evento').value;
    const descricao  = document.getElementById('elogio-descricao').value.trim();

    document.getElementById('elogio-error').className   = 'alert error';
    document.getElementById('elogio-success').className = 'alert success';

    if (!_elogioCadetes.length) { showAlert('elogio-error', 'Adicione ao menos um aluno.'); return; }
    if (!tipoId)     { showAlert('elogio-error', 'Selecione o tipo de elogio.'); return; }
    if (!dataEvento) { showAlert('elogio-error', 'Informe a data do evento.'); return; }
    if (!descricao)  { showAlert('elogio-error', 'Preencha a descrição do motivo.'); return; }

    const btn = document.getElementById('btn-lancar-elogio');
    btn.classList.add('btn-loading'); btn.textContent = 'AGUARDE...';

    try {
      let ok = 0, errs = 0;
      const resultados = [];
      for (const cadete of _elogioCadetes) {
        try {
          const res = await fetch(`${API}/elogios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
            body: JSON.stringify({
              cadete_elogiado_id: Number(cadete.id),
              tipo_de_elogio_id:  Number(tipoId),
              data_evento:        dataEvento,
              descricao_motivo:   descricao,
              curso_id:           cursoAtivoId(),
            }),
          });
          const data = await res.json();
          if (res.ok) { ok++; resultados.push(`✓ ${cadete.label}`); }
          else        { errs++; resultados.push(`✗ ${cadete.label} — ${data.detail||'erro'}`); }
        } catch { errs++; resultados.push(`✗ ${cadete.label} — falha de conexão`); }
      }
      if (errs === 0) {
        showAlert('elogio-success', `${ok} elogio(s) lançado(s) com sucesso.`, 'success');
      } else {
        showAlert(errs === _elogioCadetes.length ? 'elogio-error' : 'elogio-success',
          `${ok} lançado(s), ${errs} falha(s): ${resultados.filter(r=>r.startsWith('✗')).join('; ')}`,
          errs === _elogioCadetes.length ? 'error' : 'success');
      }
      if (ok > 0) { toast(`${ok} elogio(s) lançado(s).`); resetLancarElogio(); }
    } catch { showAlert('elogio-error', 'Erro de conexão.'); }
    finally { btn.classList.remove('btn-loading'); btn.textContent = '★ LANÇAR ELOGIO'; }
  }


  // ══════════════════════════════════════════════════
  // ELOGIOS — LISTA (coord + aux)
  // ══════════════════════════════════════════════════
  const ELOGIOS_LISTA_STATE = { page: 1, total: 0, data: [] };
  const MEUS_ELOGIOS_STATE  = { page: 1, total: 0, data: [] };
  let _elogiosListaInit = false;

  async function loadElogiosLista(page = 1) {
    const tbody = document.getElementById('tbody-elogios-lista');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="10">CARREGANDO...</td></tr>';

    // Init selects
    if (!_elogiosListaInit) {
      _elogiosListaInit = true;
      // Populate ano
      const anoSel = document.getElementById('el-filter-ano');
      if (anoSel && anoSel.options.length <= 1) {
        const y = new Date().getFullYear();
        const todos = document.createElement('option');
        todos.value = ''; todos.textContent = 'Todos os anos';
        anoSel.appendChild(todos);
        for (let yr = y - 3; yr <= y + 1; yr++) {
          const o = document.createElement('option');
          o.value = yr; o.textContent = yr;
          anoSel.appendChild(o);
        }
      }
      // Populate turma
      const turmaSel = document.getElementById('el-filter-turma');
      if (turmaSel && turmaSel.options.length <= 1) {
        const turmas = [...new Set((window._allUsuarios||[]).map(u => u.turma).filter(t => t != null))].sort((a,b)=>a-b);
        turmas.forEach(t => {
          const o = document.createElement('option');
          o.value = t; o.textContent = `Turma ${t}`;
          turmaSel.appendChild(o);
        });
      }
    }

    const mes        = document.getElementById('el-filter-mes')?.value    || '';
    const ano        = document.getElementById('el-filter-ano')?.value    || '';
    const status     = document.getElementById('el-filter-status')?.value || '';
    const turma      = document.getElementById('el-filter-turma')?.value  || '';
    const cadeteIdEL = getSdValue('sd-cadete-elogios-lista');

    const params = new URLSearchParams({ page, limit: LIMIT });
    if (mes)        params.set('mes',       mes);
    if (ano)        params.set('ano',       ano);
    // Nunca mostrar pendentes na aba Ver Elogios — default aprovado
    params.set('status', status || 'aprovado');
    if (turma)      params.set('turma',     turma);
    if (cadeteIdEL) params.set('cadete_id', cadeteIdEL);
    if (cursoAtivoId() != null) params.set('curso_id', cursoAtivoId());
    applySort(params, 'elogios_lista');

    const statusLabel = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Descartado' };
    const statusStyle = {
      pendente:   'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
      aprovado:   'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);',
      rejeitado:  'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);',
    };

    try {
      const res = await fetch(`${API}/coordenador/elogios?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      Object.assign(ELOGIOS_LISTA_STATE, { page, total: json.total, data: json.data });

      document.getElementById('meta-elogios-lista').textContent =
        `${json.total} elogio(s) encontrado(s)`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM ELOGIO ENCONTRADO</td></tr>';
        document.getElementById('pag-info-elogios-lista').textContent = '0 registros';
        document.getElementById('pag-btns-elogios-lista').innerHTML = '';
        return;
      }

      tbody.innerHTML = json.data.map(e => {
        const dataEvento  = e.data_evento ? fmtDateOnly(e.data_evento) : '—';
        const motivoPreview = e.descricao_motivo ? e.descricao_motivo.substring(0,50)+(e.descricao_motivo.length>50?'…':'') : '—';
        const turmaPel = e.turma != null ? `${e.turma}${e.pel ?? ''}` : '—';
        return `
        <tr style="cursor:pointer;" onclick="openElogioModal(${e.id})">
          <td class="td-mono">#${e.id}</td>
          <td class="td-mono">${fmtDate(e.created_at)}</td>
          <td class="td-mono">${dataEvento}</td>
          <td class="td-mono">${resolveUser(e.cadete_elogiado_id)}</td>
          <td class="td-mono">${turmaPel}</td>
          <td class="td-mono" style="font-size:11px;color:var(--muted);">${e.responsavel_numero_geral != null ? e.responsavel_numero_geral + ' ' : ''}${e.responsavel_username || '—'}</td>
          <td style="font-size:12px;">${e.tipo_elogio}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700;">+${e.pontos}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${motivoPreview}</td>
          <td><span class="pill" style="${statusStyle[e.status]||''}">${statusLabel[e.status]||e.status}</span></td>
          <td class="td-mono">${e.approved_at ? fmtDate(e.approved_at) : '—'}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-elogios-lista', 'pag-info-elogios-lista', ELOGIOS_LISTA_STATE, loadElogiosLista);

    } catch {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>';
    }
  }

  // ══════════════════════════════════════════════════
  // ELOGIOS LANÇAMENTO — cadetes em lote
  // ══════════════════════════════════════════════════
  let _elogioCadetes = []; // [{id, label}]

  function adicionarCadeteElogio(id, label) {
    document.querySelectorAll('.sd-panel.open').forEach(p => p.classList.remove('open'));
    if (_elogioCadetes.find(c => c.id === id)) { toast(`${label} já adicionado.`, 'error'); return; }
    _elogioCadetes.push({ id, label });
    renderCadetesElogio();
  }

  function removerCadeteElogio(id) {
    _elogioCadetes = _elogioCadetes.filter(c => c.id !== id);
    renderCadetesElogio();
  }

  function renderCadetesElogio() {
    const lista = document.getElementById('elogio-cadetes-lista');
    const count = document.getElementById('elogio-cadetes-count');
    if (count) count.textContent = `${_elogioCadetes.length} selecionado(s)`;
    if (!lista) return;
    if (!_elogioCadetes.length) {
      lista.innerHTML = '<div class="cadetes-vazio">Nenhum aluno adicionado</div>';
      return;
    }
    lista.innerHTML = _elogioCadetes.map(c => `
      <div class="cadete-tag">
        <span class="cadete-tag-name">${c.label}</span>
        <button class="cadete-tag-remove" onclick="removerCadeteElogio(${c.id})" title="Remover">✕</button>
      </div>`).join('');
  }


  // ── MEUS ELOGIOS (cadete + dia_cfo + xerife) ──────────────────────────────────
  async function loadMeusElogios(page = 1) {
    const tbody = document.getElementById('tbody-meus-elogios');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6">CARREGANDO...</td></tr>';

    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      applySort(params, 'meus_elogios');
      const res = await fetch(`${API}/cadete/elogios?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">${d.detail || 'ERRO ' + res.status}</td></tr>`;
        document.getElementById('pag-info-meus-elogios').textContent = '';
        document.getElementById('pag-btns-meus-elogios').innerHTML = '';
        return;
      }
      const json = await res.json();

      document.getElementById('meta-meus-elogios').textContent =
        `${json.total} elogio(s) aprovado(s)`;

      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM ELOGIO APROVADO</td></tr>';
        document.getElementById('pag-info-meus-elogios').textContent = '0 registros';
        document.getElementById('pag-btns-meus-elogios').innerHTML = '';
        return;
      }

      Object.assign(MEUS_ELOGIOS_STATE, { page, total: json.total, data: json.data });

      tbody.innerHTML = json.data.map(e => {
        const dataEvento = e.data_evento
          ? fmtDateOnly(e.data_evento) : '—';
        const motivoPreview = e.descricao_motivo
          ? e.descricao_motivo.substring(0, 60) + (e.descricao_motivo.length > 60 ? '\u2026' : '') : '—';
        return `
        <tr style="cursor:pointer;" onclick="openElogioModal(${e.id})">
          <td class="td-mono">#${e.id}</td>
          <td class="td-mono">${dataEvento}</td>
          <td class="td-mono">${fmtDate(e.approved_at)}</td>
          <td style="font-size:12px;">${e.tipo_elogio}</td>
          <td class="td-mono" style="color:var(--success);font-weight:700;">+${e.pontos}</td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${motivoPreview}</td>
        </tr>`;
      }).join('');

      renderPagBar('pag-btns-meus-elogios', 'pag-info-meus-elogios',
        { page, total: json.total, data: json.data }, loadMeusElogios);

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO: ${err.message}</td></tr>`;
    }
  }


  // ── ELOGIOS — Context Menu ──────────────────────────────────────

  let _elogioModalData = null;

  async function openElogioModal(id) {
    id = Number(id);
    document.getElementById('modal-elogio').classList.add('open');
    document.getElementById('elogio-modal-body').innerHTML =
      '<div style="text-align:center;padding:24px;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--muted);">Carregando...</div>';
    document.getElementById('elogio-modal-actions').innerHTML = '';
    document.getElementById('elogio-modal-error').className = 'alert error';

    // Buscar em todos os caches disponíveis
    const cached = [
      ...(ELOGIO_STATE?.data        || []),
      ...(ELOGIOS_LISTA_STATE?.data || []),
      ...(MEUS_ELOGIOS_STATE?.data  || []),
    ].find(e => Number(e.id) === id);

    if (cached) {
      _elogioModalData = cached;
      renderElogioModal(cached);
      return;
    }

    // Fallback: buscar da API
    const role = window._currentUser?.role;
    try {
      const endpoint = ['coordenador', 'auxiliar', 'comandante_de_pelotao'].includes(role)
        ? `${API}/coordenador/elogios?page=1&limit=9999${qsCurso('&')}`
        : `${API}/cadete/elogios?page=1&limit=9999`;
      const res = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token()}` } });
      if (res.ok) {
        const json = await res.json();
        const found = (json.data || []).find(e => Number(e.id) === id);
        if (found) { _elogioModalData = found; renderElogioModal(found); return; }
      }
    } catch {}

    document.getElementById('elogio-modal-body').innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--danger);font-family:IBM Plex Mono,monospace;font-size:11px;">Elogio não encontrado.</div>';
  }

  function renderElogioModal(e) {
    const role = window._currentUser?.role;
    const isCoordAux = role === 'coordenador' || role === 'comandante_de_pelotao';
    const statusLabel = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Descartado' };
    const statusStyle = {
      pendente:  'color:var(--warn);',
      aprovado:  'color:var(--success);',
      rejeitado: 'color:var(--danger);',
    };
    const dataEvento = e.data_evento ? fmtDateOnly(e.data_evento) : '—';
    const dataCriado = e.created_at  ? fmtDate(e.created_at) : '—';
    const dataAprov  = e.approved_at ? fmtDate(e.approved_at) : '—';

    const row = (label, val) => `
      <div style="display:flex;gap:12px;align-items:baseline;border-bottom:1px solid var(--border);padding-bottom:10px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);width:110px;flex-shrink:0;">${label}</span>
        <span style="font-size:13px;color:var(--text-dim);">${val}</span>
      </div>`;

    document.getElementById('elogio-modal-body').innerHTML = `
      ${row('ID', `<span style="font-family:'IBM Plex Mono',monospace;">#${e.id}</span>`)}
      ${row('Aluno', `<strong>${resolveUser(e.cadete_elogiado_id)}</strong>`)}
      ${e.responsavel_username ? row('Lançado por', `${e.responsavel_numero_geral != null ? e.responsavel_numero_geral + ' ' : ''}${e.responsavel_username}`) : ''}
      ${row('Tipo', `<span style="color:var(--success);font-weight:700;">${e.tipo_elogio} &nbsp;+${e.pontos} pts</span>`)}
      ${row('Data do Evento', dataEvento)}
      ${row('Lançado em', dataCriado)}
      ${row('Status', `<span style="${statusStyle[e.status]||''};font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;">${statusLabel[e.status]||e.status}</span>`)}
      ${e.approved_at ? row('Decidido em', dataAprov) : ''}
      ${e.descricao_motivo ? `
      <div style="border-bottom:1px solid var(--border);padding-bottom:10px;">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Motivo</div>
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;white-space:pre-wrap;">${e.descricao_motivo}</div>
      </div>` : ''}
    `;

    // Ações por role e status
    const acts = document.getElementById('elogio-modal-actions');
    acts.innerHTML = '';

    if (isCoordAux && e.status === 'pendente') {
      acts.innerHTML = `
        <button class="btn btn-primary" style="flex:1;" onclick="elogioAcao(${e.id},'aprovado')">✓ Aprovar</button>
        <button class="btn btn-danger" style="flex:1;" onclick="elogioAcao(${e.id},'rejeitado')">✕ Descartar</button>`;
    } else if (isCoordAux && e.status !== 'pendente') {
      acts.innerHTML = `
        <button class="btn btn-ghost btn-sm" onclick="elogioAcao(${e.id},'pendente')">↺ Devolver para Pendente</button>`;
    }
  }

  async function elogioAcao(id, novoStatus) {
    const errEl = document.getElementById('elogio-modal-error');
    errEl.className = 'alert error';
    try {
      const res = await fetch(`${API}/elogios/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        errEl.textContent = d.detail || 'Erro ao alterar status.';
        errEl.className = 'alert error show'; return;
      }
      closeElogioModal();
      toast(`Elogio ${novoStatus === 'aprovado' ? 'aprovado' : novoStatus === 'rejeitado' ? 'descartado' : 'devolvido'}.`);
      // Recarregar a seção ativa
      const active = document.querySelector('.section.active')?.id || '';
      if (active.includes('elogios-pendentes')) loadElogiosPendentes(ELOGIO_STATE.page);
      else if (active.includes('elogios-lista'))  loadElogiosLista(ELOGIOS_LISTA_STATE.page);
    } catch {
      errEl.textContent = 'Erro de conexão.'; errEl.className = 'alert error show';
    }
  }

  function closeElogioModal() {
    document.getElementById('modal-elogio').classList.remove('open');
    _elogioModalData = null;
  }

  // ── ELOGIOS — seleção em lote ──────────────────────────────────────
  function getCheckedElogios() {
    return [...document.querySelectorAll('.cb-elogio:checked')].map(cb => Number(cb.value));
  }

  function onElogioCheckChange() {
    const checked = getCheckedElogios();
    const all     = document.querySelectorAll('.cb-elogio');
    const cbAll   = document.getElementById('cb-all-elogios');
    const bar     = document.getElementById('bulk-bar-elogios');
    const count   = document.getElementById('bulk-count-elogios');
    if (cbAll) { cbAll.indeterminate = checked.length > 0 && checked.length < all.length; cbAll.checked = checked.length === all.length && all.length > 0; }
    if (bar)   bar.classList.toggle('show', checked.length > 0);
    if (count) count.textContent = `${checked.length} selecionado(s)`;
    document.querySelectorAll('.cb-elogio').forEach(cb => {
      const row = document.getElementById(`elogio-row-${cb.value}`);
      if (row) row.classList.toggle('selected', cb.checked);
    });
  }

  function toggleAllElogios(cbAll) {
    document.querySelectorAll('.cb-elogio').forEach(cb => { cb.checked = cbAll.checked; });
    onElogioCheckChange();
  }

  function clearSelectionElogios() {
    document.querySelectorAll('.cb-elogio').forEach(cb => { cb.checked = false; });
    const cbAll = document.getElementById('cb-all-elogios');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    const bar = document.getElementById('bulk-bar-elogios');
    if (bar) bar.classList.remove('show');
  }

  async function bulkElogio(status) {
    const ids = getCheckedElogios();
    if (!ids.length) return;
    const label = status === 'aprovado' ? 'aprovar' : 'rejeitar';
    if (!confirm(`${label.charAt(0).toUpperCase()+label.slice(1)} ${ids.length} elogio(s)?`)) return;
    const bar = document.getElementById('bulk-bar-elogios');
    bar.querySelectorAll('button').forEach(b => b.disabled = true);
    let ok = 0, err = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`${API}/elogios/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify({ status }),
        });
        res.ok ? ok++ : err++;
      } catch { err++; }
    }
    bar.querySelectorAll('button').forEach(b => b.disabled = false);
    if (err === 0)     toast(`${ok} elogio(s) ${status === 'aprovado' ? 'aprovados' : 'rejeitados'}.`);
    else if (ok === 0) toast(`Todas as ${err} operações falharam.`, 'error');
    else               toast(`${ok} concluído(s), ${err} falha(s).`, 'error');
    loadElogiosPendentes(ELOGIO_STATE.page);
  }

  // ══════════════════════════════════════════════════
  // PUNIÇÕES — calendário e lista
  // ══════════════════════════════════════════════════

  const _punState = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, dotData: [] };
  const _punResultadoLabel = {
    pernoite: 'Pernoite', licença_nao_concedida: 'Licença N.C.', recolher: 'Recolher',
    servico_extra: 'Serviço Extra', pre_alvorada: 'Pré-Alvorada', trabalhos_e_estudos: 'Trabalhos e Estudos',
  };
  const _punResultadoColor = {
    pernoite: 'var(--warn)', licença_nao_concedida: '#ed1e24', recolher: 'var(--blue)',
    servico_extra: 'var(--blue)', pre_alvorada: 'var(--warn)', trabalhos_e_estudos: 'var(--blue)',
  };

  async function initPunicoes() {
    await loadPunCalendario();
    loadPunicoesList();
  }

  async function loadPunCalendario() {
    const { ano, mes } = _punState;
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('pun-cal-titulo').textContent = `${meses[mes - 1]} ${ano}`;

    const cadeteId = getSdValue('sd-pun-cadete');
    const params = new URLSearchParams({ ano, mes });
    if (cadeteId) params.set('cadete_id', cadeteId);
    const cursoId = cursoAtivoId();
    if (cursoId != null) params.set('curso_id', cursoId);

    try {
      const res = await fetch(`${API}/punicoes/calendario?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      _punState.dotData = res.ok ? await res.json() : [];
    } catch { _punState.dotData = []; }

    renderPunCalendario();
  }

  function renderPunCalendario() {
    const { ano, mes, dotData } = _punState;
    const cal = document.getElementById('pun-calendario');

    // Build dot map: 'YYYY-MM-DD' → [resultado,...]
    const dotMap = {};
    dotData.forEach(d => {
      const k = typeof d.data_cumprimento === 'string'
        ? d.data_cumprimento.substring(0, 10)
        : new Date(d.data_cumprimento).toISOString().substring(0, 10);
      if (!dotMap[k]) dotMap[k] = [];
      dotMap[k].push(d.resultado);
    });

    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const totalDias   = new Date(ano, mes, 0).getDate();
    const hoje        = new Date().toISOString().substring(0, 10);

    let html = dias.map(d =>
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--muted);padding:4px 0;">${d}</div>`
    ).join('');

    // Empty cells before first day
    for (let i = 0; i < primeiroDia; i++) html += '<div></div>';

    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dots = dotMap[iso] || [];
      const isHoje = iso === hoje;
      const hasPun = dots.length > 0;
      html += `
        <div onclick="punSelecionarData('${iso}')" style="cursor:pointer;padding:6px 2px;border-radius:4px;position:relative;
          background:${hasPun ? 'rgba(180,10,10,.08)' : 'transparent'};
          border:1px solid ${isHoje ? 'var(--accent)' : hasPun ? 'var(--border)' : 'transparent'};
          transition:background .15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${hasPun ? 'rgba(180,10,10,.08)' : 'transparent'}'">
          <div style="font-size:12px;${isHoje ? 'color:var(--accent);font-weight:700;' : 'color:var(--text);'}">${d}</div>
          ${dots.length ? `<div style="display:flex;justify-content:center;gap:2px;margin-top:3px;flex-wrap:wrap;">
            ${dots.slice(0, 3).map(r => `<span style="width:6px;height:6px;border-radius:50%;background:${_punResultadoColor[r]||'var(--accent)'};display:inline-block;"></span>`).join('')}
          </div>` : ''}
        </div>`;
    }

    cal.innerHTML = html;
  }

  function punMesAnterior() {
    if (_punState.mes === 1) { _punState.mes = 12; _punState.ano--; }
    else { _punState.mes--; }
    loadPunCalendario();
  }

  function punMesProximo() {
    if (_punState.mes === 12) { _punState.mes = 1; _punState.ano++; }
    else { _punState.mes++; }
    loadPunCalendario();
  }

  function punSelecionarData(iso) {
    document.getElementById('pun-filtro-data').value = iso;
    loadPunicoesList();
  }

  async function loadPunicoesList() {
    const data     = document.getElementById('pun-filtro-data').value;
    const tipo     = document.getElementById('pun-filtro-tipo').value;
    const turma    = document.getElementById('pun-filtro-turma').value;
    const pel      = document.getElementById('pun-filtro-pel').value;
    const tbody    = document.getElementById('tbody-punicoes');
    const titulo   = document.getElementById('pun-lista-titulo');
    const btnCsv   = document.getElementById('btn-pun-export-csv');

    if (!data) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">Selecione uma data no calendário ou use os filtros acima</td></tr>`;
      titulo.textContent = 'Selecione uma data no calendário';
      btnCsv.style.display = 'none';
      const btnListaReset = document.getElementById('btn-pun-export-lista');
      if (btnListaReset) btnListaReset.style.display = 'none';
      return;
    }

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;font-family:monospace;font-size:11px;color:var(--muted);">CARREGANDO...</td></tr>`;

    try {
      const params = new URLSearchParams({ data });
      if (tipo) params.set('resultado', tipo);
      const cadeteId = getSdValue('sd-pun-cadete');
      if (cadeteId) params.set('cadete_id', cadeteId);
      if (turma) params.set('turma', turma);
      if (pel) params.set('pel', pel);
      const cursoId = cursoAtivoId();
      if (cursoId != null) params.set('curso_id', cursoId);
      const res  = await fetch(`${API}/punicoes/lista?${params}`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const json = await res.json();
      window._punListaData = json;

      if (!json.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA PUNIÇÃO NESTA DATA</td></tr>`;
        titulo.textContent = `${fmtDateOnly(data)} — nenhuma punição`;
        btnCsv.style.display = 'none';
        const btnListaHide = document.getElementById('btn-pun-export-lista');
        if (btnListaHide) btnListaHide.style.display = 'none';
        return;
      }

      const tipoLabel = tipo ? ` · ${_punResultadoLabel[tipo] || tipo}` : '';
      titulo.textContent = `${fmtDateOnly(data)}${tipoLabel} — ${json.length} cadete(s)`;
      btnCsv.style.display = 'inline-flex';
      const btnLista = document.getElementById('btn-pun-export-lista');
      if (btnLista) btnLista.style.display = 'inline-flex';

      tbody.innerHTML = json.map(r => {
        const cor = _punResultadoColor[r.resultado] || 'var(--text)';
        const label = _punResultadoLabel[r.resultado] || r.resultado;
        const isCoord = window._currentUser?.role === 'coordenador';
        return `<tr>
          <td class="td-mono">${r.numero_geral ?? '—'}</td>
          <td class="td-name">${r.username}</td>
          <td class="td-mono">${r.pel ?? '—'}</td>
          <td class="td-mono">${r.turma ?? '—'}</td>
          <td><span class="pill" style="color:${cor};border-color:${cor}33;background:${cor}14;">${label}</span></td>
          <td class="td-mono">${fmtDateOnly(r.data_cumprimento)}</td>
          <td style="font-size:12px;color:var(--text-dim);">${r.observacao || '—'}</td>
          <td>${isCoord ? `<button class="btn btn-ghost btn-sm" onclick="openPunEdit(${r.anotacao_id},'${r.username}')">✎ Datas</button>` : ''}</td>
        </tr>`;
      }).join('');

    } catch {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger);font-family:monospace;font-size:11px;">ERRO AO CARREGAR</td></tr>`;
      btnCsv.style.display = 'none';
    }
  }

  async function exportarDescontosDetalhado() {
    const mes   = document.getElementById('exp-mes').value;
    const ano   = document.getElementById('exp-ano').value;
    const turma = document.getElementById('exp-turma').value;
    if (!mes || !ano || !turma) return;

    const mesesNomes = ['','JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
                        'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    const mesNome = mesesNomes[mes] || mes;

    const toBase64 = async (src) => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      } catch { return ''; }
    };
    const [abmBase64, cbmpaBase64] = await Promise.all([toBase64('ABM.png'), toBase64('CBMPA.png')]);

    const res = await fetch(
      `${API}/exportar/descontos-detalhado?turma=${turma}&mes=${mes}&ano=${ano}`,
      { headers: { 'Authorization': `Bearer ${token()}` } }
    );
    if (!res.ok) { alert('Erro ao buscar descontos.'); return; }
    const json = await res.json();
    json.data = json.data.filter(r => r.numero_geral != null);

    if (!json.data.length) { alert('Nenhum desconto encontrado para os filtros selecionados.'); return; }

    const boldMatch = (nomeCompleto, nomeGuerra) => {
      if (!nomeCompleto) return nomeGuerra || '';
      if (!nomeGuerra) return nomeCompleto;
      const idx = nomeCompleto.toUpperCase().indexOf(nomeGuerra.toUpperCase());
      if (idx === -1) return nomeCompleto;
      return nomeCompleto.slice(0, idx)
        + '<strong>' + nomeCompleto.slice(idx, idx + nomeGuerra.length) + '</strong>'
        + nomeCompleto.slice(idx + nomeGuerra.length);
    };

    // Agrupar por cadete, preservando a ordem de numero_geral
    const cadeteMap = {};
    const cadeteOrder = [];
    json.data.forEach(r => {
      const key = r.numero_geral ?? r.username;
      if (!cadeteMap[key]) {
        cadeteMap[key] = { numero_geral: r.numero_geral, username: r.username, nome_completo: r.nome_completo, posto: r.posto, infracoes: [] };
        cadeteOrder.push(key);
      }
      cadeteMap[key].infracoes.push({ codigo: r.infracao_codigo, desconto: r.desconto, anotacao_id: r.anotacao_id });
    });

    const allTabelaRows = cadeteOrder.map((key, i) => {
      const c = cadeteMap[key];
      const nome = `${c.posto || 'CAD BM'} ${boldMatch(c.nome_completo || c.username, c.username)}`;
      // Agrupar em pares: 2 itens por linha, separados por " · ", linhas centralizadas
      const itens = c.infracoes.map(inf =>
        `-${inf.desconto} (${inf.codigo}) <span style="color:#888;">MEM N° #${String(inf.anotacao_id).padStart(3,'0')}</span>`
      );
      const linhas = [];
      for (let i = 0; i < itens.length; i += 2) {
        linhas.push(itens.slice(i, i + 2).join(' &nbsp;·&nbsp; '));
      }
      const infHtml = linhas.join('<br>');
      const total = parseFloat(c.infracoes.reduce((s, inf) => s + Number(inf.desconto), 0).toFixed(2));
      return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f7f7'};">
        <td style="padding:3px 5px;border:1px solid #bbb;font-size:8px;font-weight:600;width:42%;">${nome}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;font-size:9px;font-family:monospace;color:#c0392b;text-align:center;line-height:1.7;">${infHtml}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;font-size:9px;font-family:monospace;font-weight:700;color:#c0392b;text-align:center;width:55px;">-${total}</td>
      </tr>`;
    });
    const tailCount = Math.min(3, allTabelaRows.length);
    const mainTabelaRows = allTabelaRows.slice(0, allTabelaRows.length - tailCount).join('');
    const tailTabelaRows = allTabelaRows.slice(allTabelaRows.length - tailCount).join('');

    const anoAtual = new Date().getFullYear();
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DESCONTOS DE PONTOS - ${mesNome} DE ${ano}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 11px; }
    @media print { .no-print { display: none !important; } @page { margin: 8mm 12mm; } }
  </style>
</head>
<body style="padding:10px 20px;">
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px;gap:12px;">
    <div style="flex-shrink:0;">${cbmpaBase64 ? `<img src="${cbmpaBase64}" alt="CBMPA" style="height:52px;width:auto;display:block;" />` : ''}</div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.7;">
        CORPO DE BOMBEIROS MILITAR DO PARÁ<br>
        COORDENADORIA ESTADUAL DE PROTEÇÃO E DEFESA CIVIL<br>
        DEPARTAMENTO-GERAL DE CULTURA, EDUCAÇÃO E PESQUISA<br>
        ACADEMIA BOMBEIRO MILITAR "CAPITÃO ANTÔNIO VERÍSSIMO IVO DE ABREU"<br>
        CURSO DE FORMAÇÃO DE OFICIAIS BM 2025 - CFO ABM/${anoAtual}
      </div>
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;border-top:1px solid #ccc;padding-top:5px;">
        DESCONTOS DE NOTA DE COMPORTAMENTO REFERENCIADOS PELO ANEXO I DO CÓDIGO DE ÉTICA DO CBMPA<br>
        <span style="font-size:11px;">${mesNome} DE ${ano} — TURMA ${turma}</span>
      </div>
      <div style="font-size:10px;color:#444;margin-top:2px;">${cadeteOrder.length} aluno(s) · ${json.data.length} desconto(s)</div>
    </div>
    <div style="flex-shrink:0;">${abmBase64 ? `<img src="${abmBase64}" alt="ABM" style="height:52px;width:auto;display:block;" />` : ''}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:10px;">
    <colgroup><col style="width:42%"><col><col style="width:55px"></colgroup>
    <thead>
      <tr style="background:#e8e8e8;">
        <th style="text-align:left;padding:4px 5px;border:1px solid #bbb;font-size:9px;">NOME</th>
        <th style="text-align:center;padding:4px 5px;border:1px solid #bbb;font-size:9px;">INFRAÇÕES E DESCONTOS</th>
        <th style="text-align:center;padding:4px 5px;border:1px solid #bbb;font-size:9px;">TOTAL</th>
      </tr>
    </thead>
    <tbody>${mainTabelaRows}</tbody>
  </table>
  <div style="page-break-inside:avoid;">
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:-1px;">
      <colgroup><col style="width:42%"><col><col style="width:55px"></colgroup>
      <tbody>${tailTabelaRows}</tbody>
    </table>
    <div style="margin-top:36px;display:flex;justify-content:center;">
      <div style="text-align:center;width:320px;">
        <div style="height:48px;"></div>
        <div style="border-top:1.5px solid #111;padding-top:6px;font-size:11px;line-height:1.7;">
          Matheus Barbosa <strong>Padilha</strong> - <strong>1º TEN QOBM</strong><br>
          <strong>Chefe da Seção do Corpo de Alunos ABM</strong>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:16px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#aaa;">
    Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema de Controle do Corpo de Alunos
  </div>

  <div class="no-print" style="margin-top:20px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 32px;font-size:13px;cursor:pointer;background:#111;color:#fff;border:none;border-radius:4px;letter-spacing:1px;font-weight:600;">IMPRIMIR / SALVAR PDF</button>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportarNotaComportamento() {
    if (!_expData || !_expData.length) return;

    const mes   = document.getElementById('exp-mes').value;
    const ano   = document.getElementById('exp-ano').value;
    const turma = document.getElementById('exp-turma').value;
    const mesesNomes = ['','JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO',
                        'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
    const mesNome = mesesNomes[mes] || mes;
    const anoAtual = new Date().getFullYear();

    const toBase64 = async (src) => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return await new Promise(res => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(blob);
        });
      } catch { return ''; }
    };
    const [abmBase64, cbmpaBase64] = await Promise.all([toBase64('ABM.png'), toBase64('CBMPA.png')]);

    const boldMatch = (nomeCompleto, nomeGuerra) => {
      if (!nomeCompleto) return nomeGuerra || '';
      if (!nomeGuerra) return nomeCompleto;
      const idx = nomeCompleto.toUpperCase().indexOf(nomeGuerra.toUpperCase());
      if (idx === -1) return nomeCompleto;
      return nomeCompleto.slice(0, idx)
        + '<strong>' + nomeCompleto.slice(idx, idx + nomeGuerra.length) + '</strong>'
        + nomeCompleto.slice(idx + nomeGuerra.length);
    };

    const rows = _expData.map(r => {
      const desconto  = Number(r.desconto_total) || 0;
      const elogios   = Number(r.pontos_elogios) || 0;
      const nota      = Math.min(10, Math.max(0, 8 - desconto + elogios));
      const nomeHtml  = boldMatch(r.nome_completo || r.username, r.username);
      return { ...r, desconto, elogios, nota, nomeHtml };
    });

    const allNotaRows = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f7f7'};">
        <td style="padding:2px 4px;border:1px solid #bbb;text-align:center;font-family:monospace;font-size:9px;">${r.numero_geral ?? '—'}</td>
        <td style="padding:2px 4px;border:1px solid #bbb;font-size:9px;">${r.nomeHtml}</td>
        <td style="padding:2px 4px;border:1px solid #bbb;text-align:center;font-family:monospace;font-size:9px;color:#c0392b;">-${r.desconto}</td>
        <td style="padding:2px 4px;border:1px solid #bbb;text-align:center;font-family:monospace;font-size:9px;color:#27ae60;">+${r.elogios}</td>
        <td style="padding:2px 4px;border:1px solid #bbb;text-align:center;font-weight:700;font-size:9px;">${r.nota.toFixed(2)}</td>
        <td style="padding:0;border:1px solid #bbb;height:20px;width:180px;"></td>
      </tr>`);
    const notaTailCount = Math.min(3, allNotaRows.length);
    const mainNotaRows = allNotaRows.slice(0, allNotaRows.length - notaTailCount).join('');
    const tailNotaRows = allNotaRows.slice(allNotaRows.length - notaTailCount).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>NOTA DE COMPORTAMENTO ESCOLAR - ${mesNome} DE ${ano}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 12px; }
    @media print {
      .no-print { display: none !important; }
      @page { margin: 8mm 12mm; }
    }
  </style>
</head>
<body style="padding:10px 20px;">

  <!-- Cabeçalho institucional -->
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px;gap:12px;">
    <div style="flex-shrink:0;">
      ${cbmpaBase64 ? `<img src="${cbmpaBase64}" alt="CBMPA" style="height:52px;width:auto;display:block;" />` : ''}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.7;">
        CORPO DE BOMBEIROS MILITAR DO PARÁ<br>
        COORDENADORIA ESTADUAL DE PROTEÇÃO E DEFESA CIVIL<br>
        DEPARTAMENTO-GERAL DE CULTURA, EDUCAÇÃO E PESQUISA<br>
        ACADEMIA BOMBEIRO MILITAR "CAPITÃO ANTÔNIO VERÍSSIMO IVO DE ABREU"<br>
        CURSO DE FORMAÇÃO DE OFICIAIS BM 2025 - CFO ABM/${anoAtual}
      </div>
      <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:6px;border-top:1px solid #ccc;padding-top:5px;">
        NOTA DE COMPORTAMENTO ESCOLAR - ${mesNome} DE ${ano}
      </div>
    </div>
    <div style="flex-shrink:0;">
      ${abmBase64 ? `<img src="${abmBase64}" alt="ABM" style="height:52px;width:auto;display:block;" />` : ''}
    </div>
  </div>

  <!-- Tabela de notas e assinaturas -->
  <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;">
    <colgroup><col style="width:30px"><col><col style="width:58px"><col style="width:52px"><col style="width:60px"><col style="width:180px"></colgroup>
    <thead>
      <tr style="background:#e8e8e8;">
        <th style="text-align:center;padding:3px 4px;border:1px solid #bbb;">Nº</th>
        <th style="text-align:left;padding:3px 4px;border:1px solid #bbb;">NOME DE GUERRA</th>
        <th style="text-align:center;padding:3px 4px;border:1px solid #bbb;">DESCONTO</th>
        <th style="text-align:center;padding:3px 4px;border:1px solid #bbb;">ELOGIOS</th>
        <th style="text-align:center;padding:3px 4px;border:1px solid #bbb;">NOTA FINAL</th>
        <th style="text-align:center;padding:3px 4px;border:1px solid #bbb;">ASSINATURA</th>
      </tr>
    </thead>
    <tbody>${mainNotaRows}</tbody>
  </table>
  <div style="page-break-inside:avoid;">
    <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;margin-top:-1px;">
      <colgroup><col style="width:30px"><col><col style="width:58px"><col style="width:52px"><col style="width:60px"><col style="width:180px"></colgroup>
      <tbody>${tailNotaRows}</tbody>
    </table>
    <div style="margin-top:36px;display:flex;justify-content:center;">
      <div style="text-align:center;width:320px;">
        <div style="height:48px;"></div>
        <div style="border-top:1.5px solid #111;padding-top:6px;font-size:11px;line-height:1.7;">
          Matheus Barbosa <strong>Padilha</strong> - <strong>1º TEN QOBM</strong><br>
          <strong>Chefe da Seção do Corpo de Alunos ABM</strong>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:16px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#aaa;">
    Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema de Controle do Corpo de Alunos
  </div>

  <div class="no-print" style="margin-top:20px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 32px;font-size:13px;cursor:pointer;background:#111;color:#fff;border:none;border-radius:4px;letter-spacing:1px;font-weight:600;">IMPRIMIR / SALVAR PDF</button>
  </div>

</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportarPunicoesLista() {
    const data  = document.getElementById('pun-filtro-data').value;
    const tipo  = document.getElementById('pun-filtro-tipo').value;
    const lista = (window._punListaData || []).filter(r => r.numero_geral != null);
    if (!lista.length) return;

    const dataFmt = data ? data.split('-').reverse().join('/') : '—';

    // Converter imagens para base64 para funcionar no blob
    const toBase64 = async (src) => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        return await new Promise(res => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(blob);
        });
      } catch { return ''; }
    };
    const [abmBase64, cbmpaBase64] = await Promise.all([toBase64('ABM.png'), toBase64('CBMPA.png')]);

    // Agrupar por tipo de punição
    const grupos = {};
    lista.forEach(r => {
      const g = _punResultadoLabel[r.resultado] || r.resultado;
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(r);
    });

    const _punRowHtml = (r, i) => `
              <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f7f7'};">
                <td style="padding:5px 8px;border:1px solid #bbb;text-align:center;font-family:monospace;">${r.numero_geral ?? '—'}</td>
                <td style="padding:5px 8px;border:1px solid #bbb;font-weight:600;">${r.nome_completo || r.username}</td>
                <td style="padding:5px 8px;border:1px solid #bbb;text-align:center;font-family:monospace;">${r.pel ?? '—'}</td>
                <td style="padding:5px 8px;border:1px solid #bbb;text-align:center;font-family:monospace;">${r.turma ?? '—'}</td>
                <td style="padding:0;border:1px solid #bbb;height:26px;"></td>
              </tr>`;
    const _punColgroup = `<colgroup><col style="width:36px"><col><col style="width:50px"><col style="width:65px"><col style="width:180px"></colgroup>`;
    const gruposHtml = Object.entries(grupos).map(([grp, cadetes]) => {
      const allRows = cadetes.map((r, i) => _punRowHtml(r, i));
      const tailN = Math.min(3, allRows.length);
      const mainRows = allRows.slice(0, allRows.length - tailN).join('');
      const tailRows = allRows.slice(allRows.length - tailN).join('');
      return `
      <div style="margin-bottom:32px;">
        <h2 style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1.5px solid #111;">
          Lista de ${grp} — ${dataFmt} &nbsp;·&nbsp; ${cadetes.length} cadete(s)
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          ${_punColgroup}
          <thead>
            <tr style="background:#e8e8e8;">
              <th style="text-align:center;padding:6px 8px;border:1px solid #bbb;width:36px;">Nº</th>
              <th style="text-align:left;padding:6px 8px;border:1px solid #bbb;">Nome</th>
              <th style="text-align:center;padding:6px 8px;border:1px solid #bbb;width:50px;">Pel</th>
              <th style="text-align:center;padding:6px 8px;border:1px solid #bbb;width:65px;">Turma</th>
              <th style="text-align:center;padding:6px 8px;border:1px solid #bbb;width:180px;">Assinatura</th>
            </tr>
          </thead>
          <tbody>${mainRows}</tbody>
        </table>
        <div style="page-break-inside:avoid;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:-1px;">
            ${_punColgroup}
            <tbody>${tailRows}</tbody>
          </table>
          <div style="margin-top:36px;display:flex;justify-content:center;">
            <div style="text-align:center;width:280px;">
              <div style="height:48px;"></div>
              <div style="border-top:1px solid #111;padding-top:6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Assinatura do Coordenador</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista de Punições — ${dataFmt}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 28px 36px; color: #111; font-size: 12px; }
    @media print {
      body { padding: 16px 20px; }
      .no-print { display: none !important; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- Cabeçalho institucional -->
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:20px;gap:12px;">
    <div style="flex-shrink:0;margin-left:8px;">
      ${cbmpaBase64 ? `<img src="${cbmpaBase64}" alt="CBMPA" style="height:60px;width:auto;display:block;" />` : ''}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;line-height:1.6;">
        Corpo de Bombeiros Militar do Pará<br>
        Coordenadoria Estadual de Proteção e Defesa Civil<br>
        Departamento-Geral de Cultura, Educação e Pesquisa<br>
        Academia Bombeiro Militar<br>
        "Capitão Antônio Veríssimo Ivo de Abreu"
      </div>
    </div>
    <div style="flex-shrink:0;margin-right:8px;">
      ${abmBase64 ? `<img src="${abmBase64}" alt="ABM" style="height:60px;width:auto;display:block;" />` : ''}
    </div>
  </div>

  <!-- Corpo do documento -->
  ${gruposHtml}

  <div style="margin-top:32px;border-top:1px solid #ccc;padding-top:10px;font-size:9px;color:#aaa;">
    Gerado em ${new Date().toLocaleString('pt-BR')} · Sistema de Controle do Corpo de Alunos
  </div>

  <div class="no-print" style="margin-top:28px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 32px;font-size:13px;cursor:pointer;background:#111;color:#fff;border:none;border-radius:4px;letter-spacing:1px;font-weight:600;">IMPRIMIR / SALVAR PDF</button>
  </div>

</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (win) win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ── DASHBOARD ─────────────────────────────────────────────

  const _dashLabels = {
    justificada:             'Justificada',
    perda_de_ponto:          'Perda de Ponto',
    pernoite:                'Pernoite',
    recolher:                'Recolher',
    licença_nao_concedida:   'Lic. Não Concedida',
    sem_veredito:            'Aguard. Veredito',
  };
  const _dashColors = {
    justificada:             '#22c55e',
    perda_de_ponto:          '#ef4444',
    pernoite:                '#3b82f6',
    recolher:                '#f59e0b',
    licença_nao_concedida:   '#a855f7',
    sem_veredito:            '#64748b',
  };

  function initDashboard() {
    const role      = window._currentUser?.role;
    const filtersEl = document.getElementById('dash-filters');
    if (!filtersEl) return;

    filtersEl.style.display = 'flex';

    // Populate year-range selects once (default to the last 3 years up to now)
    const anoIniEl = document.getElementById('dash-ano-inicio');
    const anoFimEl = document.getElementById('dash-ano-fim');
    const now      = new Date();
    if (anoIniEl && !anoIniEl.dataset.init) {
      const cur = now.getFullYear();
      const opts = [cur-3, cur-2, cur-1, cur, cur+1].map(y => `<option value="${y}">${y}</option>`).join('');
      anoIniEl.innerHTML = opts;
      anoFimEl.innerHTML = opts;
      anoIniEl.value     = String(cur - 2);
      anoFimEl.value     = String(cur);
      anoIniEl.dataset.init = '1';
    }
    _dashSelectedPeriod = null;

    const advEl = document.getElementById('dash-filters-adv');
    if (role === 'coordenador' || role === 'auxiliar' || role === 'comandante') {
      if (advEl) advEl.style.display = 'flex';

      // Turma options
      const turmaSet = new Set((window._allUsuarios || []).map(u => u.turma).filter(t => t != null));
      const turmaEl  = document.getElementById('dash-turma');
      if (turmaEl) {
        turmaEl.innerHTML = '<option value="">Todas as turmas</option>' +
          [...turmaSet].sort((a, b) => a - b).map(t => `<option value="${t}">Turma ${t}</option>`).join('');
      }

      // Cadete dropdown
      const list = document.getElementById('sd-dash-cadete-list');
      if (list) {
        list.innerHTML = (window._allUsuarios || [])
          .filter(u => ['cadete', 'aluno', 'dia_cfo', 'dia_curso', 'xerife'].includes(u.role))
          .sort((a, b) => (a.numero_geral ?? 9999) - (b.numero_geral ?? 9999))
          .map(u => {
            const lbl = `${u.numero_geral != null ? u.numero_geral + ' ' : ''}${u.username}`;
            return `<div class="sd-option" data-value="${u.id}" data-search="${lbl.toLowerCase()}" onclick="selectSdOption('sd-dash-cadete',${u.id},'${lbl.replace(/'/g,"\\'")}',refreshDashboard)">${lbl}</div>`;
          }).join('');
      }
    } else {
      if (advEl) advEl.style.display = 'none';
    }

    refreshDashboard();
  }

  function onDashTurmaChange() {
    const turma = document.getElementById('dash-turma')?.value;
    const pelEl = document.getElementById('dash-pel');
    if (pelEl) {
      const pelSet = new Set((window._allUsuarios || [])
        .filter(u => !turma || String(u.turma) === turma)
        .map(u => u.pel).filter(Boolean));
      pelEl.innerHTML = '<option value="">Todos os pelotões</option>' +
        [...pelSet].sort().map(p => `<option value="${p}">${p}</option>`).join('');
    }
    refreshDashboard();
  }

  function clearDashFilters() {
    clearSd('sd-dash-cadete', () => {});
    const turmaEl  = document.getElementById('dash-turma');
    const pelEl    = document.getElementById('dash-pel');
    const anoIniEl = document.getElementById('dash-ano-inicio');
    const anoFimEl = document.getElementById('dash-ano-fim');
    const cur      = new Date().getFullYear();
    if (turmaEl)  turmaEl.value  = '';
    if (pelEl)    pelEl.value    = '';
    if (anoIniEl) anoIniEl.value = String(cur - 2);
    if (anoFimEl) anoFimEl.value = String(cur);
    _dashSelectedPeriod = null;
    refreshDashboard();
  }

  // Re-fetches both the monthly stacked chart and the pie chart (for the selected period, if any)
  async function refreshDashboard() {
    await loadDashboardMensal();
    loadDashboard();
  }

  function _dashCommonParams() {
    const role   = window._currentUser?.role;
    const params = new URLSearchParams();

    if (role === 'coordenador' || role === 'auxiliar' || role === 'comandante') {
      const cId   = getSdValue('sd-dash-cadete');
      const turma = document.getElementById('dash-turma')?.value;
      const pel   = document.getElementById('dash-pel')?.value;
      if (cId) {
        params.set('cadete_id', cId);
      } else if (turma) {
        params.set('turma', turma);
        if (pel) params.set('pel', pel);
      }
    }
    return params;
  }

  let _dashSelectedPeriod = null; // { ano, mes } | null
  let _dashMonthlyData    = [];
  const _MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const _MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                         'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  async function loadDashboardMensal() {
    const container = document.getElementById('dash-stacked-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">CARREGANDO...</div>';

    const params   = _dashCommonParams();
    const anoIni   = document.getElementById('dash-ano-inicio')?.value;
    const anoFim   = document.getElementById('dash-ano-fim')?.value;
    if (anoIni) params.set('ano_inicio', anoIni);
    if (anoFim) params.set('ano_fim',    anoFim);

    try {
      const res = await fetch(`${API}/dashboard/anotacoes/mensal?${params}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error((await res.json()).detail || res.status);
      const json = await res.json();
      _dashMonthlyData = json.data;
      renderDashboardStackedChart(json.data);
    } catch (e) {
      container.innerHTML = `<div style="color:var(--danger);font-family:monospace;font-size:11px;padding:24px;text-align:center;">ERRO: ${e.message}</div>`;
    }
  }

  function _dashCadetePrefix() {
    const cId = getSdValue('sd-dash-cadete');
    if (!cId) return '';
    const trigger = document.getElementById('sd-dash-cadete-trigger');
    return trigger?.textContent ? `Aluno: ${trigger.textContent} · ` : '';
  }

  function _updateDashStackedSubtitle() {
    const subtitle = document.getElementById('dash-stacked-subtitle');
    if (!subtitle) return;
    subtitle.textContent = `${_dashCadetePrefix()}Clique em uma barra para ver o detalhe do mês`;
  }

  function renderDashboardStackedChart(rawData) {
    const container = document.getElementById('dash-stacked-container');
    if (!container) return;

    _updateDashStackedSubtitle();

    const ocultarVazios = document.getElementById('dash-ocultar-vazios')?.checked;
    const data = ocultarVazios ? rawData.filter(d => d.total > 0) : rawData;

    if (!data.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM MÊS COM DADOS NO PERÍODO</div>';
      return;
    }

    const maxTotal = Math.max(1, ...data.map(d => d.total));
    const resultadosUsados = [...new Set(data.flatMap(d => Object.keys(d.resultados)))];
    const multiAno = new Set(data.map(d => d.ano)).size > 1;

    const bars = data.map(d => {
      const h = d.total > 0 ? Math.max(2, (d.total / maxTotal) * 140) : 2;
      const isSelected = _dashSelectedPeriod && _dashSelectedPeriod.ano === d.ano && _dashSelectedPeriod.mes === d.mes;
      let segHtml = '';
      if (d.total > 0) {
        segHtml = Object.entries(d.resultados).map(([resultado, val]) => {
          const segH = (val / d.total) * h;
          return `<div style="width:100%;height:${segH}px;background:${_dashColors[resultado] || '#94a3b8'};" title="${_dashLabels[resultado] || resultado}: ${val}"></div>`;
        }).join('');
      }
      const label = multiAno ? `${_MESES_ABREV[d.mes - 1]}/${String(d.ano).slice(2)}` : _MESES_ABREV[d.mes - 1];
      return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto;width:40px;cursor:pointer;"
             onclick="selectDashPeriod(${d.ano},${d.mes})">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);min-height:14px;">${d.total || ''}</span>
          <div style="width:100%;max-width:34px;display:flex;flex-direction:column-reverse;height:140px;
                       border-radius:3px 3px 0 0;overflow:hidden;
                       outline:${isSelected ? '2px solid var(--accent)' : 'none'};outline-offset:2px;
                       background:${d.total === 0 ? 'var(--surface2)' : 'transparent'};">
            ${segHtml}
          </div>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${isSelected ? 'var(--accent)' : 'var(--muted)'};font-weight:${isSelected ? '700' : '400'};white-space:nowrap;">${label}</span>
        </div>`;
    }).join('');

    const legend = resultadosUsados.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;justify-content:center;">
        ${resultadosUsados.map(r => `
          <div style="display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text-dim);">
            <div style="width:10px;height:10px;border-radius:2px;background:${_dashColors[r] || '#94a3b8'};"></div>
            ${_dashLabels[r] || r}
          </div>`).join('')}
      </div>` : '';

    container.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:6px;overflow-x:auto;padding-bottom:4px;">${bars}</div>
      ${legend}`;
  }

  function selectDashPeriod(ano, mes) {
    const same = _dashSelectedPeriod && _dashSelectedPeriod.ano === ano && _dashSelectedPeriod.mes === mes;
    _dashSelectedPeriod = same ? null : { ano, mes };
    renderDashboardStackedChart(_dashMonthlyData);
    loadDashboard();
  }

  // Agrega os totais de _dashMonthlyData (já carregado pelo gráfico de barras) por resultado
  function showDashTotalPeriodo() {
    const container = document.getElementById('dash-chart-container');
    const subtitle  = document.getElementById('dash-chart-subtitle');
    if (!container) return;
    if (!_dashMonthlyData.length) {
      container.innerHTML = '<div style="text-align:center;padding:48px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM DADO NO PERÍODO</div>';
      if (subtitle) subtitle.textContent = '';
      return;
    }

    _dashSelectedPeriod = null;
    renderDashboardStackedChart(_dashMonthlyData);

    const totais = {};
    _dashMonthlyData.forEach(d => {
      Object.entries(d.resultados).forEach(([resultado, val]) => {
        totais[resultado] = (totais[resultado] || 0) + val;
      });
    });

    const data  = Object.entries(totais).map(([resultado, total]) => ({ resultado, total }));
    const total = data.reduce((s, d) => s + d.total, 0);

    const anoIni = document.getElementById('dash-ano-inicio')?.value;
    const anoFim = document.getElementById('dash-ano-fim')?.value;
    const periodoLabel = anoIni === anoFim ? anoIni : `${anoIni}–${anoFim}`;
    if (subtitle) subtitle.textContent = `${_dashCadetePrefix()}${total} anotação(ões) · Total ${periodoLabel}`;
    renderDashboardChart(data, total);
  }

  async function loadDashboard() {
    const container = document.getElementById('dash-chart-container');
    const subtitle  = document.getElementById('dash-chart-subtitle');
    if (!container) return;

    if (!_dashSelectedPeriod) {
      showDashTotalPeriodo();
      return;
    }

    container.innerHTML = '<div style="text-align:center;padding:48px;font-family:monospace;font-size:11px;color:var(--muted);">CARREGANDO...</div>';

    const params = _dashCommonParams();
    params.set('ano', _dashSelectedPeriod.ano);
    params.set('mes', _dashSelectedPeriod.mes);

    try {
      const res = await fetch(`${API}/dashboard/anotacoes?${params}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error((await res.json()).detail || res.status);
      const json = await res.json();
      const mesLabel = `${_MESES_NOMES[_dashSelectedPeriod.mes - 1]}/${_dashSelectedPeriod.ano}`;
      if (subtitle) subtitle.textContent = `${_dashCadetePrefix()}${json.total} anotação(ões) · ${mesLabel}`;
      renderDashboardChart(json.data, json.total);
    } catch (e) {
      container.innerHTML = `<div style="color:var(--danger);font-family:monospace;font-size:11px;padding:24px;text-align:center;">ERRO: ${e.message}</div>`;
    }
  }

  function renderDashboardChart(data, total) {
    const container = document.getElementById('dash-chart-container');
    if (!container) return;

    if (!total) {
      container.innerHTML = '<div style="text-align:center;padding:48px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUMA ANOTAÇÃO APROVADA</div>';
      return;
    }

    const segments = data.filter(d => d.total > 0).map(d => ({
      resultado: d.resultado,
      label:     _dashLabels[d.resultado]  || d.resultado,
      value:     d.total,
      color:     _dashColors[d.resultado] || '#94a3b8',
    }));

    // SVG donut
    const cx = 100, cy = 100, R = 78, r = 44;
    let angle = -90;
    let paths = '';

    const xy = (a, rad) => ({
      x: cx + rad * Math.cos(a * Math.PI / 180),
      y: cy + rad * Math.sin(a * Math.PI / 180),
    });

    segments.forEach(seg => {
      const sweep = (seg.value / total) * 360;
      const end   = angle + sweep;
      const large = sweep > 180 ? 1 : 0;

      if (sweep >= 359.99) {
        // Full circle: draw two halves
        const t = xy(-90, R), b = xy(90, R), ti = xy(-90, r), bi = xy(90, r);
        paths += `<path d="M ${t.x} ${t.y} A ${R} ${R} 0 1 1 ${b.x} ${b.y} A ${R} ${R} 0 1 1 ${t.x} ${t.y} M ${ti.x} ${ti.y} A ${r} ${r} 0 1 0 ${bi.x} ${bi.y} A ${r} ${r} 0 1 0 ${ti.x} ${ti.y} Z" fill="${seg.color}" fill-rule="evenodd"/>`;
      } else {
        const s1 = xy(angle, R), e1 = xy(end, R);
        const s2 = xy(end, r),   e2 = xy(angle, r);
        paths += `<path d="M ${s1.x} ${s1.y} A ${R} ${R} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${r} ${r} 0 ${large} 0 ${e2.x} ${e2.y} Z" fill="${seg.color}" stroke="#111" stroke-width="1.2"/>`;
      }
      angle = end;
    });

    const svg = `
      <svg viewBox="0 0 200 200" style="width:100%;max-width:200px;display:block;margin:0 auto;">
        ${paths}
        <text x="${cx}" y="${cy - 7}" text-anchor="middle"
          font-family="IBM Plex Mono,monospace" font-size="24" font-weight="700"
          fill="var(--text)">${total}</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle"
          font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="1.5"
          fill="var(--muted)">ANOTAÇÕES</text>
      </svg>`;

    const legend = `
      <div style="margin-top:22px;display:flex;flex-direction:column;gap:9px;">
        ${segments.map(seg => {
          const pct = ((seg.value / total) * 100).toFixed(1);
          return `<div style="display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',monospace;font-size:11px;">
            <div style="width:11px;height:11px;border-radius:2px;background:${seg.color};flex-shrink:0;"></div>
            <span style="color:var(--text-dim);flex:1;">${seg.label}</span>
            <span style="color:var(--text);font-weight:700;">${seg.value}</span>
            <span style="color:var(--muted);width:44px;text-align:right;">${pct}%</span>
          </div>`;
        }).join('')}
      </div>`;

    container.innerHTML = svg + legend;
  }

  function exportarPunicoesCsv() {
    const data  = document.getElementById('pun-filtro-data').value;
    const tipo  = document.getElementById('pun-filtro-tipo').value;
    const lista = (window._punListaData || []).filter(r => r.numero_geral != null);
    if (!lista.length) return;

    const tipoLabel = tipo ? _punResultadoLabel[tipo] || tipo : 'Todas';
    const header = ['Nº Geral','Nome de Guerra','Pel','Turma','Punição','Data de Cumprimento','Observação'];
    const rows = lista.map(r => [
      r.numero_geral ?? '',
      r.username,
      r.pel ?? '',
      r.turma ?? '',
      _punResultadoLabel[r.resultado] || r.resultado,
      r.data_cumprimento ? r.data_cumprimento.substring(0, 10).split('-').reverse().join('/') : '',
      r.observacao || '',
    ]);

    const csv = [header, ...rows].map(r =>
      r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')
    ).join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `punicoes_${data}_${tipoLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  let _punEditAnotId = null;

  function openPunEdit(anotacaoId, username) {
    _punEditAnotId = anotacaoId;
    document.getElementById('pun-edit-cadete').textContent = `CAD BM ${username}`;
    document.getElementById('pun-edit-error').className = 'alert error';
    dpInit('dp-pun-edit', { mode: 'multi', pillsId: 'dp-pun-edit-pills' });
    document.getElementById('modal-pun-edit').classList.add('open');
    loadPunEditDatas(anotacaoId);
  }

  async function loadPunEditDatas(anotacaoId) {
    try {
      const res = await fetch(`${API}/vereditos/${anotacaoId}/cumprimentos`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const list = res.ok ? await res.json() : [];
      renderPunEditDatas(list, anotacaoId);
    } catch { renderPunEditDatas([], anotacaoId); }
  }

  function renderPunEditDatas(list, anotacaoId) {
    const el = document.getElementById('pun-edit-datas-list');
    if (!el) return;
    el.innerHTML = list.length
      ? list.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);padding:6px 10px;border-radius:4px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--warn);">${fmtDateOnly(c.data)}</span>
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;color:var(--danger);" onclick="punRemoveCumprimento(${c.id},${anotacaoId})">✕</button>
        </div>`).join('')
      : `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">Nenhuma data registrada</div>`;
  }

  async function punAddCumprimento() {
    const datas = dpGetSelected("dp-pun-edit");
    if (!datas.length || !_punEditAnotId) return;
    document.getElementById('pun-edit-error').className = 'alert error';
    try {
      const results = await Promise.all(datas.map(data =>
        fetch(`${API}/vereditos/${_punEditAnotId}/cumprimentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify({ data }),
        })
      ));
      const failed = results.filter(r => !r.ok);
      if (failed.length) {
        const err = await failed[0].json().catch(() => ({}));
        document.getElementById('pun-edit-error').textContent = err.detail || 'Erro ao adicionar.';
        document.getElementById('pun-edit-error').className = 'alert error show'; return;
      }
      dpInit('dp-pun-edit', { mode: 'multi', pillsId: 'dp-pun-edit-pills' });
      await loadPunEditDatas(_punEditAnotId);
      await loadPunCalendario(); loadPunicoesList();
      toast(datas.length > 1 ? `${datas.length} datas adicionadas.` : 'Data adicionada.');
    } catch {
      document.getElementById('pun-edit-error').textContent = 'Erro de conexão.';
      document.getElementById('pun-edit-error').className = 'alert error show';
    }
  }

  async function punRemoveCumprimento(cumprimentoId, anotacaoId) {
    try {
      const res = await fetch(`${API}/vereditos/cumprimentos/${cumprimentoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) { toast('Erro ao remover.', 'error'); return; }
      await loadPunEditDatas(anotacaoId);
      await loadPunCalendario(); loadPunicoesList();
      toast('Data removida.');
    } catch { toast('Erro de conexão.', 'error'); }
  }

  function closePunEdit() {
    document.getElementById('modal-pun-edit').classList.remove('open');
    _punEditAnotId = null;
  }

  // Adicionar/remover cumprimentos direto do modal manot (coordenador)
  async function manot_addCumprimento() {
    const input = document.getElementById('manot-add-data-input');
    const val = input.value;
    if (!val || !_modalAnotId) return;
    try {
      const res = await fetch(`${API}/vereditos/${_modalAnotId}/cumprimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ data: val }),
      });
      const data = await res.json();
      if (!res.ok) { showAlert('manot-error', data.detail || 'Erro.'); return; }
      input.value = '';
      // Recarregar anotação
      const ar = await fetch(`${API}/anotacoes/${_modalAnotId}`, { headers: { 'Authorization': `Bearer ${token()}` } });
      const a2 = await ar.json();
      const datas2 = a2.veredito_datas_cumprimento || [];
      document.getElementById('manot-veredito-cumprimento').innerHTML =
        datas2.map(d => `<span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--warn);background:rgba(224,123,42,.1);border:1px solid rgba(224,123,42,.3);padding:3px 8px;border-radius:4px;cursor:pointer;"
          title="Clique para remover" onclick="manot_removeCumprimento(${_modalAnotId},'${d}',this)">${fmtDateOnly(d)} ✕</span>`).join('');
      toast('Data adicionada.');
    } catch { showAlert('manot-error', 'Erro de conexão.'); }
  }

  async function manot_removeCumprimento(anotacaoId, dataStr, el) {
    // Buscar id do cumprimento pela data
    try {
      const res = await fetch(`${API}/vereditos/${anotacaoId}/cumprimentos`, { headers: { 'Authorization': `Bearer ${token()}` } });
      const list = await res.json();
      const c = list.find(x => x.data === dataStr);
      if (!c) return;
      const dr = await fetch(`${API}/vereditos/cumprimentos/${c.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token()}` } });
      if (!dr.ok) { toast('Erro ao remover.', 'error'); return; }
      el.remove();
      toast('Data removida.');
    } catch { toast('Erro de conexão.', 'error'); }
  }

  // ══════════════════════════════════════════════════
  // DATE PICKER — componente reutilizável
  // ══════════════════════════════════════════════════

  const _dpState = {}; // id → { ano, mes, selected:Set, mode:'single'|'multi', onChange }

  function dpInit(id, opts = {}) {
    const now = new Date();
    const el = document.getElementById(id);
    const trigger = el?.previousElementSibling || el?.closest('.dp-wrap')?.querySelector('.dp-trigger');
    _dpState[id] = {
      ano: opts.ano || now.getFullYear(),
      mes: opts.mes || now.getMonth() + 1,
      selected: new Set(opts.selected || []),
      mode: opts.mode || 'single',
      onChange: opts.onChange || null,
      hiddenId: opts.hiddenId || null,
      labelId: opts.labelId || null,
      pillsId: opts.pillsId || null,
      triggerEl: trigger || null,
    };
    // Move o popup para <body>: cards usam backdrop-filter, que cria um
    // containing-block próprio para elementos position:fixed. Se o popup
    // permanecer dentro do card, as coordenadas de viewport calculadas em
    // dpToggle() ficam relativas ao card (não à janela), fazendo o
    // calendário abrir fora da tela em vez de junto ao campo clicado.
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
    dpRender(id);
  }

  function dpToggle(id, event) {
    if (event) event.stopPropagation();
    const el = document.getElementById(id);
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.dp-popup.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) {
      el.classList.add('open');
      dpRender(id);
      // Position after render (rAF ensures element is visible and has dimensions)
      requestAnimationFrame(() => {
        const trigger = _dpState[id]?.triggerEl;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        // If trigger has no size (hidden parent), try parent chain
        if (rect.width === 0 && rect.height === 0) return;
        const pw = el.offsetWidth  || 280;
        const ph = el.offsetHeight || 300;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let top  = rect.bottom + 4;
        let left = rect.left;
        if (left + pw > vw - 8) left = vw - pw - 8;
        if (left < 8) left = 8;
        if (top + ph > vh - 8) top = rect.top - ph - 4;
        if (top < 8) top = 8;
        el.style.top  = top  + 'px';
        el.style.left = left + 'px';
      });
    }
  }

  function dpNav(id, dir, event) {
    if (event) event.stopPropagation();
    const s = _dpState[id];
    if (!s) return;
    s.mes += dir;
    if (s.mes > 12) { s.mes = 1; s.ano++; }
    if (s.mes < 1)  { s.mes = 12; s.ano--; }
    dpRender(id);
  }

  function dpRender(id) {
    const s = _dpState[id];
    if (!s) return;
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const monthEl = document.getElementById(`${id}-month`);
    const gridEl  = document.getElementById(`${id}-grid`);
    if (monthEl) monthEl.textContent = `${meses[s.mes-1]} ${s.ano}`;
    if (!gridEl) return;

    const dias = ['D','S','T','Q','Q','S','S'];
    const primeiro = new Date(s.ano, s.mes-1, 1).getDay();
    const total    = new Date(s.ano, s.mes, 0).getDate();
    const hoje     = new Date().toISOString().substring(0,10);

    let html = dias.map(d => `<div class="dp-dow">${d}</div>`).join('');
    for (let i = 0; i < primeiro; i++) html += '<div class="dp-day empty"></div>';
    for (let d = 1; d <= total; d++) {
      const iso = `${s.ano}-${String(s.mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const sel = s.selected.has(iso);
      const cls = [
        'dp-day',
        iso === hoje ? 'today' : '',
        sel ? (s.mode === 'multi' ? 'multi-sel' : 'selected') : '',
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}" onclick="event.stopPropagation();dpSelect('${id}','${iso}')">${d}</div>`;
    }
    gridEl.innerHTML = html;

    // Add confirm button for multi mode
    const confirmId = `${id}-confirm`;
    let confirmEl = document.getElementById(confirmId);
    if (s.mode === 'multi') {
      if (!confirmEl) {
        confirmEl = document.createElement('div');
        confirmEl.id = confirmId;
        confirmEl.style.cssText = 'margin-top:10px;border-top:1px solid var(--border);padding-top:10px;';
        gridEl.parentElement.appendChild(confirmEl);
      }
      const n = s.selected.size;
      confirmEl.innerHTML = `<button class="btn btn-primary btn-full btn-sm"
        onclick="event.stopPropagation();document.getElementById('${id}').classList.remove('open')">
        ✓ Confirmar${n ? ` (${n} data${n > 1 ? 's' : ''})` : ''}
      </button>`;
    } else if (confirmEl) {
      confirmEl.remove();
    }

    dpUpdatePills(id);
  }

  function dpSelect(id, iso) {
    const s = _dpState[id];
    if (!s) return;
    if (s.mode === 'single') {
      s.selected.clear();
      s.selected.add(iso);
      // Update hidden input and label
      if (s.hiddenId) document.getElementById(s.hiddenId).value = iso;
      if (s.labelId)  document.getElementById(s.labelId).textContent = fmtDateOnly(iso);
      // Close popup
      document.getElementById(id).classList.remove('open');
    } else {
      if (s.selected.has(iso)) s.selected.delete(iso);
      else s.selected.add(iso);
    }
    dpRender(id);
    if (s.onChange) s.onChange([...s.selected].sort());
  }

  function dpUpdatePills(id) {
    const s = _dpState[id];
    if (!s || !s.pillsId) return;
    const el = document.getElementById(s.pillsId);
    if (!el) return;
    const sorted = [...s.selected].sort();
    el.innerHTML = sorted.map(d =>
      `<span class="dp-pill">${fmtDateOnly(d)}<button onclick="dpRemove('${id}','${d}')">✕</button></span>`
    ).join('');
  }

  function dpRemove(id, iso) {
    const s = _dpState[id];
    if (!s) return;
    s.selected.delete(iso);
    dpRender(id);
    if (s.onChange) s.onChange([...s.selected].sort());
  }

  function dpGetSelected(id) {
    return _dpState[id] ? [..._dpState[id].selected].sort() : [];
  }

  function dpClear(id) {
    const s = _dpState[id];
    if (!s) return;
    s.selected.clear();
    if (s.hiddenId) document.getElementById(s.hiddenId).value = '';
    if (s.labelId)  document.getElementById(s.labelId).textContent = 'Selecionar data';
    dpRender(id);
  }

  // Init pickers on page load
  function initDatePickers() {
    // Data do fato (single)
    dpInit('dp-fato', {
      mode: 'single', hiddenId: 'lanc-data-fato', labelId: 'dp-fato-label',
      onChange: (dates) => {
        document.getElementById('resumo-data-fato').textContent = dates[0] ? fmtDateOnly(dates[0]) : '—';
      }
    });
    // Data do evento elogio (single)
    dpInit('dp-elogio', { mode: 'single', hiddenId: 'elogio-data-evento', labelId: 'dp-elogio-label' });
    // Datas de cumprimento veredito (multi)
    dpInit('dp-cumpr', {
      mode: 'multi', pillsId: 'dp-cumpr-pills',
      onChange: (dates) => { _datasVeredito = dates; }
    });
    // Batch modals
    dpInit('dp-batch-cumpr', { mode: 'multi', pillsId: 'dp-batch-cumpr-pills' });
    dpInit('dp-batch-pun',   { mode: 'multi', pillsId: 'dp-batch-pun-pills'   });
    // Pernoite inopinado
    dpInit('dp-pernoite-fato', {
      mode: 'single', hiddenId: 'pernoite-data-fato', labelId: 'dp-pernoite-fato-label',
      selected: [new Date().toISOString().substring(0, 10)],
    });
    const pernoiteDataFato = document.getElementById('pernoite-data-fato');
    if (pernoiteDataFato) pernoiteDataFato.value = new Date().toISOString().substring(0, 10);
    dpInit('dp-pernoite-cumpr', {
      mode: 'multi', pillsId: 'dp-pernoite-cumpr-pills',
      onChange: () => updateResumoPernoite(),
    });
  }

  // Close pickers on outside click — but not when clicking inside a modal or dp-wrap/dp-popup
  document.addEventListener('click', e => {
    if (e.target.closest('.dp-wrap') || e.target.closest('.dp-popup')) return;
    document.querySelectorAll('.dp-popup.open').forEach(p => p.classList.remove('open'));
  }, true); // capture phase so modal stopPropagation doesn't interfere

  // Reset dp-cumpr when toggling cumprimento wrap
  const _origToggle = toggleVeredtoCumprimento;

  // ══════════════════════════════════════════════════
  // BATCH — justificadas helpers
  // ══════════════════════════════════════════════════

  function toggleAllJustificadas(cb) {
    document.querySelectorAll('.cb-just').forEach(c => c.checked = cb.checked);
    updateBatchJustSel();
  }

  function updateBatchJustSel() {
    const checked = [...document.querySelectorAll('.cb-just:checked')];
    const n = checked.length;
    const selCount = document.getElementById('batch-sel-count');
    if (selCount) selCount.textContent = n;
    const btnVeredito = document.getElementById('btn-batch-veredito');
    if (btnVeredito) btnVeredito.style.display = n >= 1 ? 'inline-flex' : 'none';
  }

  function getSelectedJustIds() {
    return [...document.querySelectorAll('.cb-just:checked')].map(c => Number(c.dataset.id));
  }

  // ── Batch Veredito ──

  function openBatchVeredito() {
    const ids = getSelectedJustIds();
    if (!ids.length) return;
    const data = window._justificadasData || [];
    const sel  = data.filter(a => ids.includes(a.id));
    document.getElementById('batch-veredito-cadetes').innerHTML =
      sel.map(a => `<div>#${a.id} — ${resolveUser(a.cad_anot)}</div>`).join('');
    document.getElementById('batch-resultado').value = '';
    aplicarTiposPunicaoPermitidos('batch-resultado');
    document.getElementById('batch-observacao').value = '';
    document.getElementById('batch-cumpr-wrap').style.display = 'none';
    document.getElementById('batch-veredito-error').className = 'alert error';
    document.getElementById('batch-veredito-success').className = 'alert success';
    document.getElementById('batch-veredito-log').style.display = 'none';
    document.getElementById('batch-veredito-log').innerHTML = '';
    dpClear('dp-batch-cumpr');
    document.getElementById('modal-batch-veredito').classList.add('open');
  }

  function closeBatchVeredito() {
    document.getElementById('modal-batch-veredito').classList.remove('open');
  }

  function toggleBatchCumpr() {
    const r = document.getElementById('batch-resultado').value;
    const requer = ['pernoite','recolher','licença_nao_concedida','servico_extra','pre_alvorada','trabalhos_e_estudos'];
    const show = requer.includes(r);
    document.getElementById('batch-cumpr-wrap').style.display = show ? 'block' : 'none';
    if (show) {
      // Re-init to ensure state is fresh and rendered
      dpInit('dp-batch-cumpr', { mode: 'multi', pillsId: 'dp-batch-cumpr-pills' });
    } else {
      dpClear('dp-batch-cumpr');
    }
  }

  async function submitBatchVeredito() {
    const ids       = getSelectedJustIds();
    const resultado = document.getElementById('batch-resultado').value;
    const observacao = document.getElementById('batch-observacao').value.trim();
    const requer    = ['pernoite','recolher','licença_nao_concedida'];
    const datas     = dpGetSelected('dp-batch-cumpr');

    if (!resultado) { showAlert('batch-veredito-error', 'Selecione um resultado.'); return; }
    if (requer.includes(resultado) && !datas.length) {
      showAlert('batch-veredito-error', 'Adicione ao menos uma data de cumprimento.'); return;
    }

    const btn = document.getElementById('btn-batch-veredito-submit');
    btn.classList.add('btn-loading'); btn.textContent = 'AGUARDE...';
    document.getElementById('batch-veredito-error').className = 'alert error';
    const log = document.getElementById('batch-veredito-log');
    log.style.display = 'block'; log.innerHTML = '';

    let ok = 0, err = 0;
    for (const anotId of ids) {
      try {
        const res = await fetch(`${API}/anotacoes/${anotId}/veredito`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify({ resultado, observacao: observacao || null, datas_cumprimento: datas.length ? datas : null }),
        });
        const data = await res.json();
        if (res.ok) {
          log.innerHTML += `<div style="color:var(--success);">✓ #${anotId}</div>`;
          ok++;
        } else {
          log.innerHTML += `<div style="color:var(--danger);">✗ #${anotId} — ${data.detail}</div>`;
          err++;
        }
      } catch {
        log.innerHTML += `<div style="color:var(--danger);">✗ #${anotId} — falha</div>`;
        err++;
      }
    }

    btn.classList.remove('btn-loading'); btn.textContent = 'REGISTRAR VEREDITO EM LOTE';
    if (err === 0) {
      showAlert('batch-veredito-success', `${ok} veredito(s) registrado(s) com sucesso.`, 'success');
      setTimeout(() => { closeBatchVeredito(); loadJustificadas(); }, 1500);
    } else {
      showAlert('batch-veredito-error', `${ok} OK, ${err} com erro. Veja o log acima.`);
      loadJustificadas();
    }
  }

  // ── Batch Punição ──

  function toggleAllVeredito(cb) {
    document.querySelectorAll('.cb-veredito').forEach(c => c.checked = cb.checked);
    updateBatchVereditoSel();
  }

  function updateBatchVereditoSel() {
    const n = document.querySelectorAll('.cb-veredito:checked').length;
    document.getElementById('batch-pun-veredito-count').textContent = n;
    document.getElementById('btn-batch-pun-veredito').style.display = n >= 1 ? 'inline-flex' : 'none';
  }

  function openBatchPunFromVeredito() {
    const ids  = [...document.querySelectorAll('.cb-veredito:checked')].map(c => Number(c.dataset.id));
    if (!ids.length) return;
    const data = window._veredatoData || [];
    const sel  = data.filter(a => ids.includes(a.id));
    document.getElementById('batch-pun-cadetes').innerHTML =
      sel.map(a => `<div>#${a.id} — ${resolveUser(a.cad_anot)} · <span style="color:var(--warn);">${a.veredito}</span></div>`).join('');
    document.getElementById('batch-pun-error').className = 'alert error';
    document.getElementById('batch-pun-success').className = 'alert success';
    dpInit('dp-batch-pun', { mode: 'multi', pillsId: 'dp-batch-pun-pills' });
    // Store ids for submit
    window._batchPunIds = ids;
    document.getElementById('modal-batch-pun').classList.add('open');
  }

  function openBatchPun() {
    const ids = getSelectedJustIds();
    if (!ids.length) return;
    window._batchPunIds = null;
    const data = window._justificadasData || [];
    const sel  = data.filter(a => ids.includes(a.id));
    document.getElementById('batch-pun-cadetes').innerHTML =
      sel.map(a => `<div>#${a.id} — ${resolveUser(a.cad_anot)}</div>`).join('');
    document.getElementById('batch-pun-error').className = 'alert error';
    document.getElementById('batch-pun-success').className = 'alert success';
    dpInit('dp-batch-pun', { mode: 'multi', pillsId: 'dp-batch-pun-pills' });
    document.getElementById('modal-batch-pun').classList.add('open');
  }

  function closeBatchPun() {
    document.getElementById('modal-batch-pun').classList.remove('open');
    window._batchPunIds = null;
  }

  function switchBatchPunTab(tab) {
    const isAdd = tab === 'add';
    document.getElementById('tab-pun-add-content').style.display = isAdd ? '' : 'none';
    document.getElementById('tab-pun-rem-content').style.display = isAdd ? 'none' : '';
    document.getElementById('tab-pun-add').style.borderBottomColor = isAdd ? 'var(--accent)' : 'transparent';
    document.getElementById('tab-pun-add').style.color = isAdd ? 'var(--accent)' : 'var(--muted)';
    document.getElementById('tab-pun-rem').style.borderBottomColor = isAdd ? 'transparent' : 'var(--accent)';
    document.getElementById('tab-pun-rem').style.color = isAdd ? 'var(--muted)' : 'var(--accent)';
    document.getElementById('batch-pun-error').className = 'alert error';
    document.getElementById('batch-pun-success').className = 'alert success';
    if (!isAdd) loadBatchPunRemList();
  }

  async function loadBatchPunRemList() {
    const ids = window._batchPunIds || getSelectedJustIds();
    const listEl = document.getElementById('batch-pun-rem-list');
    listEl.innerHTML = '<div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--muted);">Carregando...</div>';
    try {
      const results = await Promise.all(ids.map(async anotId => {
        const res = await fetch(`${API}/vereditos/${anotId}/cumprimentos`, {
          headers: { 'Authorization': `Bearer ${token()}` }
        });
        const list = res.ok ? await res.json() : [];
        return { anotId, list };
      }));
      const allDatas = results.flatMap(({ anotId, list }) =>
        list.map(c => ({ ...c, anotId }))
      );
      if (!allDatas.length) {
        listEl.innerHTML = '<div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--muted);">Nenhuma data registrada nos selecionados.</div>';
        return;
      }
      // Agrupar por anotId para exibir com contexto
      const byAnot = {};
      allDatas.forEach(c => {
        if (!byAnot[c.anotId]) byAnot[c.anotId] = [];
        byAnot[c.anotId].push(c);
      });
      listEl.innerHTML = Object.entries(byAnot).map(([anotId, cumprs]) => `
        <div style="margin-bottom:8px;">
          <div style="font-family:IBM Plex Mono,monospace;font-size:10px;color:var(--muted);margin-bottom:4px;">Anotação #${anotId}</div>
          ${cumprs.map(c => `
            <label style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);padding:6px 10px;border-radius:4px;cursor:pointer;margin-bottom:4px;">
              <input type="checkbox" class="cb-row cb-pun-rem" data-cumpr-id="${c.id}" style="flex-shrink:0;" />
              <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:var(--warn);">${fmtDateOnly(c.data)}</span>
              ${c.tipo ? `<span style="font-size:10px;color:var(--muted);">${c.tipo}</span>` : ''}
            </label>`).join('')}
        </div>`).join('');
    } catch {
      listEl.innerHTML = '<div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--danger);">Erro ao carregar datas.</div>';
    }
  }

  async function submitBatchPunRemove() {
    const checked = [...document.querySelectorAll('.cb-pun-rem:checked')];
    if (!checked.length) { showAlert('batch-pun-error', 'Selecione ao menos uma data para remover.'); return; }
    const btn = document.getElementById('btn-batch-pun-rem-submit');
    btn.classList.add('btn-loading'); btn.textContent = 'AGUARDE...';
    document.getElementById('batch-pun-error').className = 'alert error';
    let ok = 0, err = 0;
    for (const cb of checked) {
      try {
        const res = await fetch(`${API}/vereditos/cumprimentos/${cb.dataset.cumprId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) ok++; else err++;
      } catch { err++; }
    }
    btn.classList.remove('btn-loading'); btn.textContent = 'REMOVER SELECIONADAS';
    if (err === 0) {
      showAlert('batch-pun-success', `${ok} data(s) removida(s) com sucesso.`, 'success');
      loadPunCalendario(); loadPunicoesList();
      if (window._batchPunIds) loadVeredito(); else loadJustificadas();
      setTimeout(() => loadBatchPunRemList(), 600);
    } else {
      showAlert('batch-pun-error', `${ok} removida(s), ${err} com erro.`);
      setTimeout(() => loadBatchPunRemList(), 600);
    }
  }

  async function submitBatchPun() {
    const ids   = window._batchPunIds || getSelectedJustIds();
    const datas = dpGetSelected('dp-batch-pun');
    if (!datas.length) { showAlert('batch-pun-error', 'Selecione ao menos uma data.'); return; }

    const btn = document.getElementById('btn-batch-pun-submit');
    btn.classList.add('btn-loading'); btn.textContent = 'AGUARDE...';
    document.getElementById('batch-pun-error').className = 'alert error';

    let ok = 0, err = 0;
    for (const anotId of ids) {
      // Add each date as cumprimento
      for (const d of datas) {
        try {
          const res = await fetch(`${API}/vereditos/${anotId}/cumprimentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
            body: JSON.stringify({ data: d }),
          });
          if (res.ok) ok++; else err++;
        } catch { err++; }
      }
    }

    btn.classList.remove('btn-loading'); btn.textContent = 'ADICIONAR DATAS';
    if (err === 0) {
      showAlert('batch-pun-success', `${ok} data(s) adicionada(s) com sucesso.`, 'success');
      setTimeout(() => {
        closeBatchPun();
        loadPunCalendario(); loadPunicoesList();
        if (window._batchPunIds) loadVeredito(); else loadJustificadas();
      }, 1200);
    } else {
      showAlert('batch-pun-error', `${ok} OK, ${err} com erro.`);
    }
  }

  // ══════════════════════════════════════════════════
  // MINHAS PUNIÇÕES — calendário do cadete
  // ══════════════════════════════════════════════════

  const _meuPunState = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, dotData: [] };

  async function initMeusPunicoes() {
    await loadMeuPunCalendario();
  }

  async function loadMeuPunCalendario() {
    const { ano, mes } = _meuPunState;
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('meu-pun-cal-titulo').textContent = `${meses[mes - 1]} ${ano}`;

    try {
      const res = await fetch(`${API}/cadete/punicoes/calendario?ano=${ano}&mes=${mes}`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      _meuPunState.dotData = res.ok ? await res.json() : [];
    } catch { _meuPunState.dotData = []; }

    renderMeuPunCalendario();
  }

  function renderMeuPunCalendario() {
    const { ano, mes, dotData } = _meuPunState;
    const cal = document.getElementById('meu-pun-calendario');

    const dotMap = {};
    dotData.forEach(d => {
      const k = typeof d.data_cumprimento === 'string'
        ? d.data_cumprimento.substring(0, 10)
        : new Date(d.data_cumprimento).toISOString().substring(0, 10);
      if (!dotMap[k]) dotMap[k] = [];
      dotMap[k].push(d.resultado);
    });

    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const totalDias   = new Date(ano, mes, 0).getDate();
    const hoje        = new Date().toISOString().substring(0, 10);

    let html = dias.map(d =>
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--muted);padding:4px 0;">${d}</div>`
    ).join('');

    for (let i = 0; i < primeiroDia; i++) html += '<div></div>';

    for (let d = 1; d <= totalDias; d++) {
      const iso  = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dots = dotMap[iso] || [];
      const isHoje  = iso === hoje;
      const hasPun  = dots.length > 0;
      html += `
        <div onclick="meuPunSelecionarData('${iso}')" style="cursor:pointer;padding:6px 2px;border-radius:4px;position:relative;
          background:${hasPun ? 'rgba(180,10,10,.08)' : 'transparent'};
          border:1px solid ${isHoje ? 'var(--accent)' : hasPun ? 'var(--border)' : 'transparent'};
          transition:background .15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${hasPun ? 'rgba(180,10,10,.08)' : 'transparent'}'">
          <div style="font-size:12px;${isHoje ? 'color:var(--accent);font-weight:700;' : 'color:var(--text);'}">${d}</div>
          ${hasPun ? `<div style="display:flex;justify-content:center;gap:2px;margin-top:3px;flex-wrap:wrap;">
            ${dots.slice(0,3).map(r => `<span style="width:6px;height:6px;border-radius:50%;background:${_punResultadoColor[r]||'var(--accent)'};display:inline-block;"></span>`).join('')}
          </div>` : ''}
        </div>`;
    }
    cal.innerHTML = html;
  }

  function meuPunMesAnterior() {
    if (_meuPunState.mes === 1) { _meuPunState.mes = 12; _meuPunState.ano--; }
    else _meuPunState.mes--;
    loadMeuPunCalendario();
  }

  function meuPunMesProximo() {
    if (_meuPunState.mes === 12) { _meuPunState.mes = 1; _meuPunState.ano++; }
    else _meuPunState.mes++;
    loadMeuPunCalendario();
  }

  async function meuPunSelecionarData(iso) {
    document.getElementById('meu-pun-lista-titulo').textContent = fmtDateOnly(iso);
    const lista = document.getElementById('meu-pun-lista');
    lista.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);text-align:center;padding:16px;">CARREGANDO...</div>`;

    try {
      const res = await fetch(`${API}/cadete/punicoes/lista?data=${iso}`, {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      const json = res.ok ? await res.json() : [];

      if (!json.length) {
        lista.innerHTML = `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);text-align:center;padding:16px;">Nenhuma punição nesta data</div>`;
        return;
      }

      lista.innerHTML = json.map(r => {
        const cor   = _punResultadoColor[r.resultado] || 'var(--text)';
        const label = _punResultadoLabel[r.resultado] || r.resultado;
        return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${cor};padding:14px 16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span class="pill" style="color:${cor};border-color:${cor}33;background:${cor}14;">${label}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);">${fmtDateOnly(r.data_cumprimento)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim);">${resolveInfracao(r.infracao)}</div>
          ${r.observacao ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;font-style:italic;">${r.observacao}</div>` : ''}
        </div>`;
      }).join('');

    } catch {
      lista.innerHTML = `<div style="color:var(--danger);font-family:monospace;font-size:11px;text-align:center;padding:16px;">ERRO AO CARREGAR</div>`;
    }
  }

  // ── RECURSOS ──────────────────────────────────

  const _recursoStatusLabel = { pendente: 'Pendente', despachado: 'Despachado', deferido: 'Deferido', indeferido: 'Indeferido' };
  const _recursoStatusStyle = {
    pendente:   'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);',
    despachado: 'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);',
    deferido:   'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);',
    indeferido: 'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);',
  };

  const _resStyle = { justificada: 'color:var(--success);border-color:rgba(46,204,113,.3);background:var(--success-dim);', perda_de_ponto: 'color:var(--danger);border-color:rgba(192,57,43,.3);background:var(--danger-dim);', pernoite: 'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);', 'licença_nao_concedida': 'color:#ed1e24;border-color:rgba(180,10,10,.25);background:rgba(237,30,36,.08);', recolher: 'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);', servico_extra: 'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);', pre_alvorada: 'color:var(--warn);border-color:rgba(224,123,42,.3);background:var(--warn-dim);', trabalhos_e_estudos: 'color:var(--blue);border-color:rgba(52,152,219,.3);background:var(--blue-dim);' };
  const _resLabel = { justificada: 'Justificada', perda_de_ponto: 'Perda de Ponto', pernoite: 'Pernoite', 'licença_nao_concedida': 'Licença N.C.', recolher: 'Recolher', servico_extra: 'Serviço Extra', pre_alvorada: 'Pré-Alvorada', trabalhos_e_estudos: 'Trabalhos e Estudos' };

  async function loadRecursos(page = 1) {
    const tbody = document.getElementById('tbody-recursos');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">CARREGANDO...</td></tr>';
    const status = document.getElementById('filter-recursos-status')?.value || '';
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (status) params.set('status', status);
    applySort(params, 'recursos');
    try {
      const res  = await fetch(`${API}/recursos?${params}`, { headers: { 'Authorization': `Bearer ${token()}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.status); }
      const json = await res.json();
      document.getElementById('meta-recursos').textContent = `${json.total} pedido(s) de recurso`;
      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM RECURSO</td></tr>';
        document.getElementById('pag-info-recursos').textContent = '0 registros';
        document.getElementById('pag-btns-recursos').innerHTML = '';
        return;
      }
      window._recursosMap = {};
      json.data.forEach(r => { window._recursosMap[r.id] = r; });
      tbody.innerHTML = json.data.map(r => {
        const acaoBtn = r.status === 'pendente'
          ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="openDespacharRecursoModal(${r.id})">📤 Despachar</button>`
          : '—';
        return `
        <tr>
          <td class="td-mono">#${r.id}</td>
          <td class="td-mono">#${r.anotacao_id}</td>
          <td style="font-size:12px;">${r.cadete_numero != null ? r.cadete_numero + ' ' : ''}${r.cadete_username}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(r.infracao)}</td>
          <td><span class="pill" style="${_resStyle[r.veredito_resultado]||''}">${_resLabel[r.veredito_resultado]||r.veredito_resultado||'—'}</span></td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${r.motivo}</td>
          <td class="td-mono">${fmtDate(r.criado_em)}</td>
          <td><span class="pill" style="${_recursoStatusStyle[r.status]||''}">${_recursoStatusLabel[r.status]||r.status}</span></td>
          <td>${acaoBtn}</td>
        </tr>`;
      }).join('');
      renderPagBar('pag-btns-recursos', 'pag-info-recursos', { page, total: json.total, data: json.data }, loadRecursos);
    } catch(e) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);font-family:monospace;font-size:11px;padding:24px;">ERRO: ${e.message}</td></tr>`;
    }
  }

  async function loadComandanteRecursos(page = 1) {
    const tbody = document.getElementById('tbody-cmd-recursos');
    if (!tbody) return;
    tbody.innerHTML = '<tr class="loading-row"><td colspan="9">CARREGANDO...</td></tr>';
    const status = document.getElementById('filter-cmd-recursos-status')?.value || '';
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (status) params.set('status', status);
    applySort(params, 'cmd_recursos');
    try {
      const res  = await fetch(`${API}/recursos?${params}`, { headers: { 'Authorization': `Bearer ${token()}` } });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.status); }
      const json = await res.json();
      document.getElementById('meta-cmd-recursos').textContent = `${json.total} recurso(s)`;
      if (!json.data.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;font-family:monospace;font-size:11px;color:var(--muted);">NENHUM RECURSO</td></tr>';
        document.getElementById('pag-info-cmd-recursos').textContent = '0 registros';
        document.getElementById('pag-btns-cmd-recursos').innerHTML = '';
        return;
      }
      window._recursosMap = {};
      json.data.forEach(r => { window._recursosMap[r.id] = r; });
      tbody.innerHTML = json.data.map(r => {
        const acaoBtn = r.status === 'despachado'
          ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;" onclick="openJulgarRecursoModal(${r.id})">⚖ Julgar</button>`
          : '—';
        return `
        <tr>
          <td class="td-mono">#${r.id}</td>
          <td class="td-mono">#${r.anotacao_id}</td>
          <td style="font-size:12px;">${r.cadete_numero != null ? r.cadete_numero + ' ' : ''}${r.cadete_username}</td>
          <td style="font-size:12px;color:var(--text-dim);">${resolveInfracaoShort(r.infracao)}</td>
          <td><span class="pill" style="${_resStyle[r.veredito_resultado]||''}">${_resLabel[r.veredito_resultado]||r.veredito_resultado||'—'}</span></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-dim);">${r.motivo}</td>
          <td class="td-mono">${fmtDate(r.criado_em)}</td>
          <td><span class="pill" style="${_recursoStatusStyle[r.status]||''}">${_recursoStatusLabel[r.status]||r.status}</span></td>
          <td>${acaoBtn}</td>
        </tr>`;
      }).join('');
      renderPagBar('pag-btns-cmd-recursos', 'pag-info-cmd-recursos', { page, total: json.total, data: json.data }, loadComandanteRecursos);
    } catch(e) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);font-family:monospace;font-size:11px;padding:24px;">ERRO: ${e.message}</td></tr>`;
    }
  }

  let _recursoAnotId = null;

  function openRecursoModal(anotId) {
    _recursoAnotId = anotId;
    document.getElementById('recurso-anot-id').textContent = `#${anotId}`;
    document.getElementById('recurso-motivo').value = '';
    document.getElementById('recurso-error').style.display = 'none';
    document.getElementById('recurso-success').style.display = 'none';
    document.getElementById('btn-recurso-enviar').disabled = false;
    document.getElementById('modal-recurso').classList.add('open');
  }

  function closeRecursoModal() {
    document.getElementById('modal-recurso').classList.remove('open');
    _recursoAnotId = null;
  }

  async function submitRecurso() {
    if (!_recursoAnotId) return;
    const motivo = document.getElementById('recurso-motivo').value.trim();
    if (!motivo) {
      const el = document.getElementById('recurso-error');
      el.textContent = 'Descreva o motivo do recurso.';
      el.style.display = 'block';
      return;
    }
    document.getElementById('btn-recurso-enviar').disabled = true;
    document.getElementById('recurso-error').style.display = 'none';
    try {
      const res = await fetch(`${API}/anotacoes/${_recursoAnotId}/recurso`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const json = await res.json();
      if (!res.ok) {
        const el = document.getElementById('recurso-error');
        el.textContent = json.detail || 'Erro ao enviar recurso.';
        el.style.display = 'block';
        document.getElementById('btn-recurso-enviar').disabled = false;
        return;
      }
      const el = document.getElementById('recurso-success');
      el.textContent = 'Pedido de recurso enviado com sucesso!';
      el.style.display = 'block';
      setTimeout(() => { closeRecursoModal(); loadMeusVereditos(); }, 1500);
    } catch {
      const el = document.getElementById('recurso-error');
      el.textContent = 'Erro de conexão.';
      el.style.display = 'block';
      document.getElementById('btn-recurso-enviar').disabled = false;
    }
  }

  let _despacharRecursoId = null;

  function openDespacharRecursoModal(recursoId) {
    const r = (window._recursosMap || {})[recursoId];
    if (!r) return;
    _despacharRecursoId = recursoId;
    document.getElementById('despachar-recurso-id').textContent = recursoId;
    document.getElementById('despachar-cadete').textContent = `${r.cadete_numero != null ? r.cadete_numero + ' ' : ''}${r.cadete_username}`;
    document.getElementById('despachar-anot-id').textContent = `#${r.anotacao_id}`;
    document.getElementById('despachar-veredito').innerHTML = `<span class="pill" style="${_resStyle[r.veredito_resultado]||''}">${_resLabel[r.veredito_resultado]||r.veredito_resultado||'—'}</span>`;
    document.getElementById('despachar-motivo').textContent = r.motivo;
    document.getElementById('despachar-observacao').value = '';
    document.getElementById('despachar-error').style.display = 'none';
    document.getElementById('modal-despachar-recurso').classList.add('open');
  }

  function closeDespacharRecursoModal() {
    document.getElementById('modal-despachar-recurso').classList.remove('open');
    _despacharRecursoId = null;
  }

  async function submitDespacharRecurso() {
    if (!_despacharRecursoId) return;
    const observacao_coord = document.getElementById('despachar-observacao').value.trim() || null;
    try {
      const res = await fetch(`${API}/recursos/${_despacharRecursoId}/despachar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacao_coord }),
      });
      const json = await res.json();
      if (!res.ok) {
        const el = document.getElementById('despachar-error');
        el.textContent = json.detail || 'Erro ao despachar recurso.';
        el.style.display = 'block';
        return;
      }
      closeDespacharRecursoModal();
      loadRecursos();
      loadBadges();
    } catch {
      const el = document.getElementById('despachar-error');
      el.textContent = 'Erro de conexão.';
      el.style.display = 'block';
    }
  }

  let _julgarRecursoId = null;

  function openJulgarRecursoModal(recursoId) {
    const r = (window._recursosMap || {})[recursoId];
    if (!r) return;
    _julgarRecursoId = recursoId;
    document.getElementById('julgar-recurso-id').textContent = recursoId;
    document.getElementById('julgar-cadete').textContent = `${r.cadete_numero != null ? r.cadete_numero + ' ' : ''}${r.cadete_username}`;
    document.getElementById('julgar-anot-id').textContent = `#${r.anotacao_id}`;
    document.getElementById('julgar-data-fato').textContent = fmtDateOnly(r.data_do_fato);
    document.getElementById('julgar-infracao').textContent = resolveInfracao(r.infracao);
    document.getElementById('julgar-veredito').innerHTML = `<span class="pill" style="${_resStyle[r.veredito_resultado]||''}">${_resLabel[r.veredito_resultado]||r.veredito_resultado||'—'}</span>`;

    const obsWrap = document.getElementById('julgar-obs-veredito-wrap');
    if (r.veredito_observacao) {
      document.getElementById('julgar-obs-veredito').textContent = r.veredito_observacao;
      obsWrap.style.display = '';
    } else { obsWrap.style.display = 'none'; }

    const descrWrap = document.getElementById('julgar-descricao-wrap');
    if (r.descricao) {
      document.getElementById('julgar-descricao').textContent = r.descricao;
      descrWrap.style.display = 'block';
    } else { descrWrap.style.display = 'none'; }

    const justWrap = document.getElementById('julgar-just-wrap');
    if (r.justificativa) {
      document.getElementById('julgar-just-texto').textContent = r.justificativa;
      justWrap.style.display = 'block';
    } else { justWrap.style.display = 'none'; }

    const obsCoordWrap = document.getElementById('julgar-obs-coord-wrap');
    if (r.observacao_coord) {
      document.getElementById('julgar-obs-coord').textContent = r.observacao_coord;
      obsCoordWrap.style.display = 'block';
    } else { obsCoordWrap.style.display = 'none'; }

    document.getElementById('julgar-motivo').textContent = r.motivo;
    document.getElementById('julgar-observacao').value = '';
    document.getElementById('julgar-error').style.display = 'none';
    document.getElementById('modal-julgar-recurso').classList.add('open');
  }

  function closeJulgarRecursoModal() {
    document.getElementById('modal-julgar-recurso').classList.remove('open');
    _julgarRecursoId = null;
  }

  async function submitJulgarRecurso(status) {
    if (!_julgarRecursoId) return;
    const observacao = document.getElementById('julgar-observacao').value.trim() || null;
    if (status === 'indeferido' && !confirm('Confirma o indeferimento? Uma anotação de perda de ponto será lançada automaticamente.')) return;
    try {
      const res = await fetch(`${API}/recursos/${_julgarRecursoId}/julgar`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, observacao }),
      });
      const json = await res.json();
      if (!res.ok) {
        const el = document.getElementById('julgar-error');
        el.textContent = json.detail || 'Erro ao julgar recurso.';
        el.style.display = 'block';
        return;
      }
      closeJulgarRecursoModal();
      const role = window._currentUser?.role;
      if (role === 'coordenador') loadRecursos();
      else loadComandanteRecursos();
      loadBadges();
    } catch {
      const el = document.getElementById('julgar-error');
      el.textContent = 'Erro de conexão.';
      el.style.display = 'block';
    }
  }

