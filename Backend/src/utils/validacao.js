function numeroMonetarioValido(valor, permitirZero = false) {
  return typeof valor === 'number'
    && Number.isFinite(valor)
    && (permitirZero ? valor >= 0 : valor > 0);
}

function dataISOValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const dataConvertida = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(dataConvertida.getTime())
    && dataConvertida.toISOString().slice(0, 10) === data;
}

module.exports = { numeroMonetarioValido, dataISOValida };
