import {
  Home, Utensils, Car, Heart, Popcorn, ShoppingBag,
  GraduationCap, MoreHorizontal, Circle, Plane, Gift, Wrench, Smartphone,
} from 'lucide-react';

const ICONES = {
  home: Home,
  utensils: Utensils,
  car: Car,
  heart: Heart,
  popcorn: Popcorn,
  'shopping-bag': ShoppingBag,
  'graduation-cap': GraduationCap,
  plane: Plane,
  gift: Gift,
  wrench: Wrench,
  smartphone: Smartphone,
  'more-horizontal': MoreHorizontal,
};

export const OPCOES_ICONES = [
  { valor: 'home', rotulo: 'Casa' },
  { valor: 'utensils', rotulo: 'Alimentação' },
  { valor: 'car', rotulo: 'Transporte' },
  { valor: 'heart', rotulo: 'Saúde' },
  { valor: 'popcorn', rotulo: 'Lazer' },
  { valor: 'shopping-bag', rotulo: 'Compras' },
  { valor: 'graduation-cap', rotulo: 'Educação' },
  { valor: 'plane', rotulo: 'Viagem' },
  { valor: 'gift', rotulo: 'Presente' },
  { valor: 'wrench', rotulo: 'Serviços' },
  { valor: 'smartphone', rotulo: 'Assinaturas' },
  { valor: 'more-horizontal', rotulo: 'Outros' },
];

export const OPCOES_CORES = [
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#22d3ee',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#868c94',
];

export default function IconeCategoria({ nome, size = 16, ...props }) {
  const Icone = ICONES[nome] || Circle;
  return <Icone size={size} {...props} />;
}
