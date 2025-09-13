class Exame {
  /**
   * @param {string} patientName Nome do paciente.
   * @param {string} examType Tipo de exame (ex: Hemograma).
   * @param {object} results Objeto com os resultados numéricos e qualitativos do exame.
   * @param {string} diagnosis O diagnóstico ou sumário do exame.
   * @param {string} rawText O texto bruto extraído do exame.
   */
  constructor(patientName, examType, results, diagnosis, rawText) {
    this.patientName = patientName;
    this.examType = examType;
    this.results = results;
    this.diagnosis = diagnosis;
    this.rawText = rawText;
  }
}

module.exports = {
  Exame,
};
