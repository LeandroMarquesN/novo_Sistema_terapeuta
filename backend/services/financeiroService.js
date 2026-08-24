const db = require('../config/db');

class FinanceiroService {
  /**
   * Retorna todas as clínicas categorizadas para o Dashboard Master
   */
  async obterRelatorioGeral() {
    const sql = `
      SELECT
        c.id,
        c.nome_clinica,
        c.slug,
        c.dono_nome,
        c.telefone_clinica,
        c.telefone_dono,
        c.email_master,
        c.senha_master,
        c.plano_id,
        c.gateway_id,
        c.tipo_plano,
        c.data_inicio_trial,
        c.data_fim_gratuidade,
        c.data_fim_promocao,
        c.valor_atual,
        c.status,
        c.data_cadastro,
        c.data_expiracao,
        c.data_cancelamento,
        c.criado_em,
        p.nome_plano,
        p.valor_base,
        p.valor_promocional,
        DATEDIFF(CURRENT_DATE, c.data_cadastro) as dias_vida
      FROM clinicas c
      LEFT JOIN planos p ON c.plano_id = p.id
    `;

    const [clinicas] = await db.execute(sql);

    // Categorizando os dados para facilitar o seu Frontend
    return {
      estatisticas: {
        total: clinicas.length,
        ativas: clinicas.filter(c => c.status === 'ativo').length,
        inadimplentes: clinicas.filter(c => c.status === 'inadimplente').length,
        suspensas: clinicas.filter(c => c.status === 'suspenso').length,
        precisamReajuste: clinicas.filter(c => c.dias_vida > 90 && c.valor_atual < c.valor_base).length,
        // Calcula o faturamento total (MRR) somando as ativas
        mrrTotal: clinicas
          .filter(c => c.status === 'ativo')
          .reduce((acc, curr) => acc + parseFloat(curr.valor_atual || 0), 0)
      },
      listagemCompleta: clinicas.map(c => ({
        ...c,
        precisaUpgrade: c.dias_vida > 90 && c.valor_atual < (c.valor_base || 0),
        fase: c.dias_vida <= 90 ? 'Promocional' : 'Regular'
      }))
    };
  }

  /**
   * Aplica reajuste automático para quem passou de 90 dias
   */
  async aplicarReajustes() {
    const sql = `
      UPDATE clinicas c
      INNER JOIN planos p ON c.plano_id = p.id
      SET c.valor_atual = p.valor_base
      WHERE DATEDIFF(CURRENT_DATE, c.data_cadastro) > 90
        AND c.valor_atual < p.valor_base
        AND c.status = 'ativo'
    `;
    const [result] = await db.execute(sql);
    return result.affectedRows;
  }

  /**
   * Controle Manual: Alterar status da clínica (Bloquear/Ativar/Cancelar)
   */
  async alterarStatusClinica(id, novoStatus) {
    const sql = 'UPDATE clinicas SET status = ? WHERE id = ?';
    const [result] = await db.execute(sql, [novoStatus, id]);
    return { success: true, id, status: novoStatus, affected: result.affectedRows };
  }
}

// APENAS ESTA EXPORTAÇÃO:
module.exports = new FinanceiroService();