import sys
import json
import spacy

# Carrega o modelo de linguagem do spaCy.
# Certifique-se de que o modelo foi baixado:
# python -m spacy download en_core_web_sm
# Para Português: python -m spacy download pt_core_news_sm
nlp = spacy.load("en_core_web_sm")

def process_exam_text(text):
    """
    Processa o texto de um exame para extrair informações relevantes
    e gerar um diagnóstico simples.

    Args:
        text (str): O texto bruto extraído do PDF.

    Returns:
        dict: Um dicionário com os dados do exame e o diagnóstico.
    """
    doc = nlp(text)

    # Lógica de extração de dados e diagnóstico (simulação)
    # Na vida real, esta parte seria muito mais complexa e específica
    # para o tipo de exame e idioma.
    patient_name = "Paciente Desconhecido"
    exam_type = "Exame Genérico"
    results = {
        "Glucose": "85 mg/dL",
        "Cholesterol": "190 mg/dL",
        "Hemoglobin": "14.5 g/dL"
    }

    # Análise de diagnóstico simples
    diagnosis = "Resultados dentro da normalidade."
    if "high" in text.lower() or "alto" in text.lower():
        diagnosis = "Alguns valores estão acima dos limites."
    elif "low" in text.lower() or "baixo" in text.lower():
        diagnosis = "Alguns valores estão abaixo dos limites."

    return {
        "patientName": patient_name,
        "examType": exam_type,
        "results": results,
        "diagnosis": diagnosis
    }

if __name__ == "__main__":
    # Lê a entrada bruta do console (stdin)
    input_text = sys.stdin.read()

    # Processa o texto e gera o resultado
    output_data = process_exam_text(input_text)

    # Imprime o resultado como uma string JSON para que o Node.js possa ler
    print(json.dumps(output_data))
