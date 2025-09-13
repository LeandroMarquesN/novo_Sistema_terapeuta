/**
 * Simulates text extraction from a PDF file.
 * In a real-world scenario, this would use a library like `pdf-parse`.
 * @param {string} filePath The path to the uploaded file.
 * @returns {Promise<string>} The extracted text.
 */
async function extractTextFromPDF(filePath) {
  // Simulating the delay and result of a real OCR process
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock data representing the text extracted from a PDF.
  // This text is then passed to the NLP script for analysis.
  return `
    RELATÓRIO DE EXAME - HEMOGRAMA COMPLETO

    Paciente: João da Silva
    Data: 01/09/2025

    Resultados:
    Leucócitos: 13.5 (high)
    Hemoglobina: 14.5 g/dL
    Glicose: 110 mg/dL
    Colesterol: 210 mg/dL (high)
    Plaquetas: 140 x10³/µL (low)
  `;
}

module.exports = {
  extractTextFromPDF,
};
