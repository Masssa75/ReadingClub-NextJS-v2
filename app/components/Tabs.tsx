'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Tabs() {
  const pathname = usePathname();

  const tabs = [
    { path: '/calibrate', label: '📊 Calibrate' },
    { path: '/practice', label: '▶ Practice' },
    { path: '/admin/snapshots', label: '🗂️ Snapshots' },
  ];

  return (
    <div className="flex gap-2.5 mb-8" style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`
              px-8 py-4 text-lg font-normal transition-all duration-300
              ${
                isActive
                  ? 'text-yellow-400'
                  : 'text-gray-400 hover:text-gray-200'
              }
            `}
            style={{
              borderBottom: isActive ? '3px solid #FDD835' : '3px solid transparent',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
