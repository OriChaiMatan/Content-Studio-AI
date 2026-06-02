import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  accentColor?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', accent = false, accentColor = 'bg-primary', hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 relative overflow-hidden',
        accent ? 'pl-5' : '',
        hover ? 'transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : '',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {accent && (
        <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`} />
      )}
      {children}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, icon, children, className = '' }: SectionCardProps) {
  return (
    <Card accent className={`p-8 ${className}`}>
      <h3 className="text-[22px] font-serif font-medium text-primary mb-6 flex items-center gap-2">
        <span className="material-symbols-outlined">{icon}</span>
        {title}
      </h3>
      {children}
    </Card>
  );
}
