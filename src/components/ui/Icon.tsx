interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function Icon({ name, className = '', filled = false, size = 'md' }: IconProps) {
  const fillStyle = filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
  return (
    <span
      className={`material-symbols-outlined select-none ${sizeClasses[size]} ${className}`}
      style={{ fontVariationSettings: fillStyle }}
    >
      {name}
    </span>
  );
}
