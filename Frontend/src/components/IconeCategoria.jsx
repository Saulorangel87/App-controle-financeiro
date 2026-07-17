import { Home, Utensils, Car, Heart, Popcorn, ShoppingBag, GraduationCap, MoreHorizontal, Circle } from 'lucide-react';

const ICONES = {
  home: Home,
  utensils: Utensils,
  car: Car,
  heart: Heart,
  popcorn: Popcorn,
  'shopping-bag': ShoppingBag,
  'graduation-cap': GraduationCap,
  'more-horizontal': MoreHorizontal,
};

export default function IconeCategoria({ nome, size = 16, ...props }) {
  const Icone = ICONES[nome] || Circle;
  return <Icone size={size} {...props} />;
}
