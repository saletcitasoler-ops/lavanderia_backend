// public/script.js (Versión SIN LOGIN)
document.addEventListener('DOMContentLoaded', () => {
    let cajaAbierta = false;

    // --- Selectores de elementos ---
    const navLinks = document.querySelectorAll('.nav-link');
    const vistas = document.querySelectorAll('.vista');
    const cajaAbiertaInfoDiv = document.getElementById('caja-abierta-info');
    const cajaCerradaFormDiv = document.getElementById('caja-cerrada-form');
    const montoInicialInfoSpan = document.getElementById('monto-inicial-info');
    const abrirCajaForm = document.getElementById('abrir-caja-form');
    const appContainer = document.getElementById('app-container');

    // =================================================================================
    // --- SISTEMA DE AVISOS PERSONALIZADO (MODAL) ---
    // =================================================================================
    const modalBackdrop = document.getElementById('custom-modal-backdrop');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const okBtn = document.getElementById('modal-ok-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    function showCustomModal(title, message, type = 'alert') {
        return new Promise(resolve => {
            modalTitle.textContent = title;
            modalBody.innerHTML = `<p>${message.replace(/\n/g, '<br>')}</p>`;
            cancelBtn.style.display = (type === 'confirm') ? 'inline-block' : 'none';
            okBtn.textContent = 'Aceptar';
            modalBackdrop.style.display = 'flex';
            okBtn.onclick = () => { modalBackdrop.style.display = 'none'; resolve(true); };
            cancelBtn.onclick = () => { modalBackdrop.style.display = 'none'; resolve(false); };
        });
    }
    
    // --- Lógica de UI y Navegación ---
    const actualizarEstadoUI = () => {
        navLinks.forEach(link => {
            if (link.getAttribute('data-vista') !== 'caja') {
                link.classList.toggle('disabled', !cajaAbierta);
            }
        });
        cajaAbiertaInfoDiv.style.display = cajaAbierta ? 'block' : 'none';
        cajaCerradaFormDiv.style.display = cajaAbierta ? 'none' : 'block';
        if (cajaAbierta && document.querySelector('.nav-link[data-vista="caja"].active')) {
            document.querySelector('.nav-link[data-vista="entrada"]').click();
        }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            if (link.classList.contains('disabled')) return;
            const vistaId = link.getAttribute('data-vista');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            vistas.forEach(vista => vista.classList.toggle('active', vista.id === `vista-${vistaId}`));
        });
    });

    // =================================================================================
    // LÓGICA DE INICIO (MODIFICADA)
    // =================================================================================
    const initApp = async () => {
        await initCaja();
        initEntrada();
        initSalida();
        initGastos();
        initReportes();
    };
    
    // Muestra la aplicación directamente
    appContainer.style.display = 'flex';
    initApp();


    // =================================================================================
    // VISTA DE CAJA
    // =================================================================================
    async function initCaja() {
        try {
            const response = await fetch('/api/caja/estado', { credentials: 'include' });
            if (!response.ok) throw new Error('Error de red al verificar la caja');
            const estado = await response.json();
            
            cajaAbierta = estado.abierta;
            if (estado.abierta) {
                montoInicialInfoSpan.textContent = `Gs. ${Number(estado.datos.monto_inicial).toLocaleString('es-PY')}`;
                
                document.getElementById('cerrar-caja-btn').onclick = async () => {
                    const resumenDiv = document.getElementById('resumen-caja');
                    const confirmacion = await showCustomModal('Calcular Balance', '¿Estás seguro de que quieres calcular el balance del día?', 'confirm');
                    if (!confirmacion) return;
                    
                    try {
                        const res = await fetch('/api/caja/resumen-dia', { credentials: 'include' });
                        const data = await res.json();
                        
                        const tablaIngresos = document.getElementById('tabla-resumen-ingresos');
                        const tablaGastos = document.getElementById('tabla-resumen-gastos');
                        const resumenFinalDiv = document.querySelector('.resumen-final');

                        tablaIngresos.innerHTML = `<thead><tr><th>Boleta</th><th>Cliente</th><th>Monto Cobrado</th><th>Forma de Pago</th></tr></thead><tbody>${data.detalleIngresos.map(i => `<tr><td>#${i.boleta_id}</td><td>${i.nombre_completo}</td><td>Gs. ${Number(i.monto_recibido).toLocaleString('es-PY')}</td><td>${i.forma_pago}</td></tr>`).join('') || '<tr><td colspan="4">Sin ingresos hoy.</td></tr>'}</tbody>`;
                        
                        tablaGastos.innerHTML = `<thead><tr><th>Descripción</th><th>Monto</th></tr></thead><tbody>${data.detalleGastos.map(g => `<tr><td>${g.descripcion}</td><td>Gs. ${Number(g.costo).toLocaleString('es-PY')}</td></tr>`).join('') || '<tr><td colspan="2">Sin gastos hoy.</td></tr>'}</tbody>`;
                        
                        const montoInicial = Number(estado.datos.monto_inicial);
                        const totalIngresos = data.totalIngresosEfectivo + data.totalIngresosElectronico;
                        const balanceEnCaja = montoInicial + data.totalIngresosEfectivo - data.totalGastos;

                        resumenFinalDiv.innerHTML = `
                            <p><strong>Monto Inicial:</strong> Gs. ${montoInicial.toLocaleString('es-PY')}</p>
                            <p><strong>(+) Ingresos en Efectivo:</strong> Gs. ${data.totalIngresosEfectivo.toLocaleString('es-PY')}</p>
                            <p><strong>(+) Ingresos Electrónicos:</strong> Gs. ${data.totalIngresosElectronico.toLocaleString('es-PY')}</p>
                            <p><strong>(-) Total Gastos (Efectivo):</strong> Gs. ${data.totalGastos.toLocaleString('es-PY')}</p>
                            <hr><p><strong>VENTA TOTAL DEL DÍA: Gs. ${totalIngresos.toLocaleString('es-PY')}</strong></p>
                            <p><strong>BALANCE ESPERADO EN CAJA: Gs. ${balanceEnCaja.toLocaleString('es-PY')}</strong></p>
                            <button id="confirmar-cierre-btn" class="submit-button" style="background-color: #d9534f;">Confirmar y Cerrar Caja</button>
                        `;
                        
                        resumenDiv.style.display = 'grid';

                        document.getElementById('confirmar-cierre-btn').onclick = async () => {
                            const confirmacionFinal = await showCustomModal('Confirmar Cierre', 'Una vez cerrada la caja, no podrás realizar más operaciones hoy. ¿Estás seguro?', 'confirm');
                            if (!confirmacionFinal) return;
                            
                            await fetch('/api/caja/cerrar', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    ingresos_dia: totalIngresos, 
                                    gastos_dia: data.totalGastos, 
                                    balance_final: balanceEnCaja 
                                }),
                                credentials: 'include'
                            });
                            await showCustomModal('Éxito', 'Caja cerrada exitosamente. La aplicación se recargará.', 'alert');
                            window.location.reload();
                        };
                    } catch (error) {
                         await showCustomModal('Error', 'No se pudo calcular el resumen del día.', 'alert');
                    }
                };
            }
        } catch (error) {
            console.error("Error al verificar estado de caja:", error);
            document.getElementById('caja-panel-body').innerHTML = `<p style="color:red;">Error de conexión. Asegúrate de que el servidor esté corriendo.</p>`;
        }
        actualizarEstadoUI();
    }

    abrirCajaForm.addEventListener('submit', async e => {
        e.preventDefault();
        const monto = parseInt(document.getElementById('monto_inicial').value.replace(/\D/g, '')) || 0;
        const res = await fetch('/api/caja/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto_inicial: monto }),
            credentials: 'include'
        });
        if (res.ok) {
            await showCustomModal('Éxito', '¡Caja abierta con éxito!', 'alert');
            await initCaja();
        } else {
            const err = await res.json();
            await showCustomModal('Error', `No se pudo abrir la caja: ${err.error}`, 'alert');
        }
    });

    // =================================================================================
    // VISTA DE ENTRADA
    // =================================================================================
    function initEntrada() {
        const form = document.getElementById('trabajo-form');
        const tableBody = document.querySelector('#trabajos-table');
        const opciones = {
            tipo_prenda: ['Ropas', 'Edredón', 'Calzados', 'Tintorería'], servicio: ['Lavado', 'Planchado', 'Lavado y Planchado'],
            forma_pago: ['Efectivo', 'Transferencia', 'QR/Tarjeta'], estado_pago: ['Pendiente', 'Pago parcial', 'Abonado']
        };
        for (const key in opciones) {
            const select = document.getElementById(key);
            if (select) select.innerHTML = opciones[key].map(opt => `<option value="${opt}">${opt}</option>`).join('');
        }
        const fetchTrabajos = async () => {
            if (!cajaAbierta) return;
            const response = await fetch('/api/trabajos', { credentials: 'include' });
            const trabajos = await response.json();
            tableBody.innerHTML = `<thead><tr><th>Boleta</th><th>Cliente</th><th>Monto</th></tr></thead><tbody>${trabajos.map(t => `<tr><td>${t.boleta_id}</td><td>${t.nombre_completo}</td><td>Gs. ${Number(t.monto_total).toLocaleString('es-PY')}</td></tr>`).join('')}</tbody>`;
            if (trabajos.length === 0) tableBody.querySelector('tbody').innerHTML = '<tr><td colspan="3">No hay trabajos pendientes.</td></tr>';
        };
        form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!cajaAbierta) { await showCustomModal('Aviso', 'Debe abrir la caja para registrar trabajos.', 'alert'); return; }
            const formData = {
                nombre_cliente: document.getElementById('nombre_cliente').value,
                contacto_celular: document.getElementById('contacto_celular').value, 
                email_cliente: document.getElementById('email_cliente').value,
                tipo_prenda: document.getElementById('tipo_prenda').value, 
                servicio: document.getElementById('servicio').value, 
                descripcion: document.getElementById('descripcion').value,
                monto_total: parseFloat(document.getElementById('monto_total').value.replace(/\D/g, '')) || 0, 
                monto_recibido: parseFloat(document.getElementById('monto_recibido').value.replace(/\D/g, '')) || 0, 
                forma_pago: document.getElementById('forma_pago').value,
                estado_pago: document.getElementById('estado_pago').value,
            };
            const response = await fetch('/api/trabajos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });
            if (response.ok) {
                const nuevoTrabajo = await response.json();
                await showCustomModal('Éxito', `Trabajo N° ${nuevoTrabajo.boleta_id} registrado!`, 'alert');
                form.reset();
                fetchTrabajos();
            } else { await showCustomModal('Error', 'No se pudo registrar el trabajo.', 'alert'); }
        });
        document.querySelector('.nav-link[data-vista="entrada"]').addEventListener('click', fetchTrabajos);
    }

    // =================================================================================
    // VISTA DE SALIDA
    // =================================================================================
    function initSalida() {
        const form = document.getElementById('salida-form');
        const resultadoDiv = document.getElementById('salida-resultado');
        const tablaEntregadosHoy = document.getElementById('tabla-entregados-hoy');
        const fechaHoySpan = document.getElementById('fecha-hoy');

        const fetchEntregadosHoy = async () => {
            if (!cajaAbierta) return;
            const response = await fetch('/api/trabajos/entregados-hoy', { credentials: 'include' });
            const trabajos = await response.json();
            fechaHoySpan.textContent = new Date().toLocaleDateString('es-PY');
            tablaEntregadosHoy.innerHTML = `<thead><tr><th>Hora</th><th>Boleta</th><th>Cliente</th><th>Monto</th></tr></thead><tbody>${trabajos.map(t => `<tr><td>${t.hora_salida}</td><td>#${t.boleta_id}</td><td>${t.nombre_completo}</td><td>Gs. ${Number(t.monto_total).toLocaleString('es-PY')}</td></tr>`).join('') || '<tr><td colspan="4">Aún no se entregaron trabajos hoy.</td></tr>'}</tbody>`;
        };
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!cajaAbierta) { await showCustomModal('Aviso', 'Debe abrir la caja para operar.', 'alert'); return; }
            const termino = document.getElementById('termino-busqueda').value.trim();
            resultadoDiv.innerHTML = '';
            if (!termino) return;
            try {
                const response = await fetch(`/api/trabajos/buscar?termino=${encodeURIComponent(termino)}`, { credentials: 'include' });
                const resultados = await response.json();
                const enStock = resultados.filter(t => t.estado_stock === 'En Stock');
                const entregados = resultados.filter(t => t.estado_stock === 'Entregado');
                let html = '<h4>En Stock</h4>';
                if (enStock.length > 0) {
                    html += enStock.map(t => `<div class="resultado-item">
                        <div class="resultado-info">
                            <p><strong>Boleta #${t.boleta_id}</strong> - ${t.nombre_completo}</p>
                            <p>Total: Gs. ${Number(t.monto_total).toLocaleString('es-PY')} | Pagado: Gs. ${Number(t.monto_recibido).toLocaleString('es-PY')}</p>
                            <p>Estado Pago: <strong>${t.estado_pago}</strong></p>
                        </div>
                        <div class="resultado-acciones">
                            <button class="details-button" onclick='mostrarDetalles(${JSON.stringify(t)})'>Ver Detalles</button>
                            <button class="submit-button" onclick='marcarEntregado(${JSON.stringify(t)})'>Marcar como Entregado</button>
                        </div>
                        </div>`).join('');
                } else { 
                    html += '<p>No se encontraron trabajos en stock con ese criterio.</p>'; 
                }
                html += '<hr style="margin: 20px 0;"><h4>Historial de Entregados (Búsqueda)</h4>';
                if (entregados.length > 0) {
                    html += entregados.map(t => `<div class="resultado-item">
                        <div class="resultado-info">
                            <p><strong>Boleta #${t.boleta_id}</strong> - ${t.nombre_completo}</p>
                            <p>Entregado el: ${t.fecha_salida_f || 'N/A'}</p>
                        </div>
                        <div class="resultado-acciones">
                            <button class="details-button" onclick='mostrarDetalles(${JSON.stringify(t)})'>Ver Detalles</button>
                        </div>
                    </div>`).join('');
                } else { 
                    html += '<p>No se encontraron trabajos ya entregados con ese criterio.</p>'; 
                }
                resultadoDiv.innerHTML = html;
            } catch (error) { resultadoDiv.innerHTML = '<p style="color: red;">Error al realizar la búsqueda.</p>'; }
        });

        document.querySelector('.nav-link[data-vista="salida"]').addEventListener('click', fetchEntregadosHoy);
    }
    
    // =================================================================================
    // VISTAS DE GASTOS Y REPORTES
    // =================================================================================
    function initGastos() { /* ...código sin cambios... */ }
    function initReportes() { /* ...código sin cambios... */ }
});

// =================================================================================
// FUNCIONES GLOBALES
// =================================================================================
async function marcarEntregado(trabajo) { /* ...código sin cambios... */ }
function mostrarDetalles(trabajo) { /* ...código sin cambios... */ }