/* Generic click-to-sort behavior for <table class="sortable-table">.
   Sorting is computed live from the current tbody rows at click time, so it
   keeps working after a table's rows are replaced (e.g. AJAX refresh) without
   any re-initialization. Columns are auto-skipped when their header has no
   text or contains an input/select/button (checkboxes, action columns). */
(function () {
  function injectStyles() {
    if (document.getElementById('sortable-table-styles')) return;
    var style = document.createElement('style');
    style.id = 'sortable-table-styles';
    style.textContent = [
      '.sortable-table thead th.sort-col { cursor: pointer; user-select: none; }',
      '.sortable-table thead th.sort-col::after { content: "\\21D5"; display: inline-block; margin-left: 5px; font-size: 9px; opacity: .35; }',
      '.sortable-table thead th.sort-col.sort-asc::after { content: "\\25B2"; opacity: 1; }',
      '.sortable-table thead th.sort-col.sort-desc::after { content: "\\25BC"; opacity: 1; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function isSortableHeader(th) {
    return !!th.textContent.trim() && !th.querySelector('input,select,button');
  }

  function parseCellValue(td) {
    var raw = (td.getAttribute('data-sort-value') || td.textContent || '').trim();
    if (raw === '' || raw === '-' || raw === '—') return { type: 'empty', value: '' };

    var dateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/);
    if (dateMatch) {
      var d = new Date(
        Number(dateMatch[3]), Number(dateMatch[2]) - 1, Number(dateMatch[1]),
        Number(dateMatch[4] || 0), Number(dateMatch[5] || 0)
      );
      if (!isNaN(d.getTime())) return { type: 'number', value: d.getTime() };
    }

    var cleaned = raw.replace(/^R\$\s*/, '').replace(/%$/, '').replace(/\s+/g, '');
    if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
      return { type: 'number', value: parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) };
    }
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return { type: 'number', value: parseFloat(cleaned) };
    }
    return { type: 'text', value: raw.toLowerCase() };
  }

  function compareRows(a, b, idx, dir) {
    var av = parseCellValue(a.cells[idx]);
    var bv = parseCellValue(b.cells[idx]);
    if (av.type === 'empty' && bv.type === 'empty') return 0;
    if (av.type === 'empty') return 1;
    if (bv.type === 'empty') return -1;
    var result = (av.type === 'text' || bv.type === 'text')
      ? String(av.value).localeCompare(String(bv.value), 'pt-BR')
      : av.value - bv.value;
    return dir === 'asc' ? result : -result;
  }

  function sortTable(table, idx, dir) {
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var rows = Array.prototype.slice.call(tbody.rows);
    rows.sort(function (a, b) { return compareRows(a, b, idx, dir); });
    rows.forEach(function (row) { tbody.appendChild(row); });
  }

  document.addEventListener('click', function (e) {
    var th = e.target.closest('table.sortable-table thead th');
    if (!th || !isSortableHeader(th)) return;
    var table = th.closest('table.sortable-table');
    var headerRow = th.parentElement;
    var idx = Array.prototype.indexOf.call(headerRow.children, th);
    var dir = th.classList.contains('sort-asc') ? 'desc' : 'asc';

    Array.prototype.forEach.call(headerRow.children, function (cell) {
      cell.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add('sort-col', dir === 'asc' ? 'sort-asc' : 'sort-desc');

    // Server-sortable tables (paginated endpoints): only the rows on the
    // current page are in the DOM, so a local reorder would silently lose
    // ordering across pages. Re-fetch from page 1 with order_by/order_dir
    // instead, via the shared _SORT_STATE the page's load function reads.
    var sortKey = th.getAttribute('data-sort-key');
    if (table.dataset.sortMode === 'server' && sortKey && window._SORT_STATE) {
      var stateKey = table.dataset.sortStateKey;
      window._SORT_STATE[stateKey] = { order_by: sortKey, order_dir: dir };
      var reloadFn = window[table.dataset.sortReload];
      if (typeof reloadFn === 'function') reloadFn(1);
      return;
    }

    sortTable(table, idx, dir);
  });

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    document.querySelectorAll('table.sortable-table thead th').forEach(function (th) {
      if (isSortableHeader(th)) th.classList.add('sort-col');
    });
  });
})();
