import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({ children, className = '', value, onChange, ...props }) {
  const selectRef = useRef(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const selected = selectRef.current?.selectedOptions?.[0];
    setLabel(selected?.text || '');
  }, [value, children]);

  return <span className={`select-shell${className ? ` ${className}` : ''}`}>
    <span className="select-value">{label}</span>
    <ChevronDown className="select-icon" size={14} aria-hidden="true" />
    <select ref={selectRef} value={value} onChange={onChange} {...props}>
      {children}
    </select>
  </span>;
}
