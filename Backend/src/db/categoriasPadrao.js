// Categorias padrão criadas automaticamente quando um novo usuário se cadastra.
// Usado tanto pelo seed de desenvolvimento quanto pelo registro real de usuários.
const CATEGORIAS_PADRAO = [
  { nome: 'Moradia', icone: 'home', cor: '#f97316', limite: 1500 },
  { nome: 'Alimentação', icone: 'utensils', cor: '#f59e0b', limite: 800 },
  { nome: 'Transporte', icone: 'car', cor: '#22d3ee', limite: 400 },
  { nome: 'Saúde', icone: 'heart', cor: '#ec4899', limite: 300 },
  { nome: 'Lazer', icone: 'popcorn', cor: '#a855f7', limite: 250 },
  { nome: 'Compras', icone: 'shopping-bag', cor: '#eab308', limite: 350 },
  { nome: 'Educação', icone: 'graduation-cap', cor: '#3b82f6', limite: 300 },
  { nome: 'Outros', icone: 'more-horizontal', cor: '#868c94', limite: 200 },
];

module.exports = CATEGORIAS_PADRAO;
