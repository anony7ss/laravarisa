'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Clock,
  ExternalLink,
  MessageSquareText,
  Sparkles,
  Bot,
  X,
  ChevronRight,
  SendHorizontal,
} from 'lucide-react';
import type { NotificationItem } from '@/app/api/admin/notifications/route';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  onTotalChange?: (count: number) => void;
}

export function NotificationCenter({
  open,
  onClose,
  onTotalChange,
}: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'appointment' | 'lead' | 'maintenance'>('all');
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('admin_read_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/notifications');
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch {
      // Falha silenciosa
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchNotifications]);

  const unreadItems = useMemo(() => {
    return items.filter((item) => !readIds.includes(item.id));
  }, [items, readIds]);

  useEffect(() => {
    if (onTotalChange) {
      onTotalChange(unreadItems.length);
    }
  }, [unreadItems.length, onTotalChange]);

  const markAllAsRead = () => {
    const allIds = items.map((i) => i.id);
    setReadIds(allIds);
    try {
      localStorage.setItem('admin_read_notifications', JSON.stringify(allIds));
    } catch {}
  };

  const markItemAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    try {
      localStorage.setItem('admin_read_notifications', JSON.stringify(next));
    } catch {}
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => item.type === activeTab);
  }, [items, activeTab]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      appointment: items.filter((i) => i.type === 'appointment').length,
      lead: items.filter((i) => i.type === 'lead').length,
      maintenance: items.filter((i) => i.type === 'maintenance').length,
    };
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="admin-notification-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-notification-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
      >
        {/* Header */}
        <div className="admin-notification-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="admin-notification-icon-wrap">
              <Bell size={18} />
              {unreadItems.length > 0 && (
                <span className="admin-notification-dot" />
              )}
            </div>
            <div>
              <h2 id="notification-center-title" style={{ margin: 0, fontSize: '14.5px', fontWeight: 500, color: '#e8e8e2', letterSpacing: '-0.01em' }}>
                Central de Notificações
              </h2>
              <small style={{ display: 'block', marginTop: '2px', fontSize: '11px', color: '#8e8e86' }}>
                {unreadItems.length > 0
                  ? `${unreadItems.length} ${unreadItems.length === 1 ? 'pendência' : 'pendências'} requer atenção`
                  : 'Tudo em dia por aqui!'}
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadItems.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="admin-notification-read-all-btn"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={15} />
                <span>Marcar lidas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="admin-notification-close-btn"
              aria-label="Fechar central"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-notification-tabs">
          <button
            type="button"
            className={activeTab === 'all' ? 'active' : ''}
            onClick={() => setActiveTab('all')}
          >
            Todas ({counts.all})
          </button>
          <button
            type="button"
            className={activeTab === 'appointment' ? 'active' : ''}
            onClick={() => setActiveTab('appointment')}
          >
            Agenda ({counts.appointment})
          </button>
          <button
            type="button"
            className={activeTab === 'lead' ? 'active' : ''}
            onClick={() => setActiveTab('lead')}
          >
            Leads ({counts.lead})
          </button>
          <button
            type="button"
            className={activeTab === 'maintenance' ? 'active' : ''}
            onClick={() => setActiveTab('maintenance')}
          >
            Manutenção ({counts.maintenance})
          </button>
        </div>

        {/* List */}
        <div className="admin-notification-body">
          {filteredItems.length === 0 ? (
            <div className="admin-notification-empty">
              <div className="admin-notification-empty-icon">
                <CheckCheck size={28} />
              </div>
              <p>Nenhuma notificação nesta categoria.</p>
              <small>Você será avisada assim que clientes agendarem ou enviarem mensagens.</small>
            </div>
          ) : (
            <div className="admin-notification-list">
              {filteredItems.map((item) => {
                const isRead = readIds.includes(item.id);
                const IconComponent =
                  item.type === 'appointment'
                    ? CalendarDays
                    : item.type === 'lead'
                      ? MessageSquareText
                      : item.type === 'maintenance'
                        ? Sparkles
                        : Bot;

                const phoneDigits = (item.phone || '').replace(/\D/g, '');
                const cleanPhone =
                  phoneDigits.startsWith('55')
                    ? phoneDigits
                    : phoneDigits.length >= 10
                      ? '55' + phoneDigits
                      : '';
                const firstName = (item.clientName || 'Cliente').split(' ')[0];
                const waText = encodeURIComponent(
                  `Olá, ${firstName}! Passando para saber como estão seus cílios e te lembrar da sua manutenção na Lara Varisa Studio ✨`,
                );
                const waUrl = cleanPhone
                  ? `https://wa.me/${cleanPhone}?text=${waText}`
                  : null;

                return (
                  <div
                    key={item.id}
                    className={`admin-notification-item ${isRead ? 'read' : 'unread'} type-${item.type}`}
                    onClick={() => markItemAsRead(item.id)}
                  >
                    <div className="admin-notification-item-icon">
                      <IconComponent size={17} />
                    </div>
                    <div className="admin-notification-item-content">
                      <div className="admin-notification-item-header">
                        <span className="admin-notification-item-badge">
                          {item.badge}
                        </span>
                        {!isRead && <span className="admin-notification-unread-dot" />}
                        <span className="admin-notification-item-time">
                          {new Date(item.timestamp).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <h3 className="admin-notification-item-title">
                        {item.title}
                      </h3>
                      <p className="admin-notification-item-desc">
                        {item.description}
                      </p>
                      <div className="admin-notification-item-actions">
                        <Link
                          href={item.link}
                          onClick={() => {
                            markItemAsRead(item.id);
                            onClose();
                          }}
                          className="admin-notification-action-link"
                        >
                          <span>{item.actionLabel}</span>
                          <ChevronRight size={14} />
                        </Link>
                        {item.type === 'maintenance' && waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-notification-wa-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              markItemAsRead(item.id);
                            }}
                          >
                            <SendHorizontal size={13} />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
