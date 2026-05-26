import { Bell, CheckCircle, XCircle, DollarSign, MapPin, User, Shield, Briefcase, Check, RotateCcw, Clock } from 'lucide-react';
import type { Notification } from '../lib/supabase';
import type { ReactNode } from 'react';

type Props = {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onApprovePayment?: (gigId: string) => void;
  onRequestRedo?: (gigId: string) => void;
  onClose: () => void;
};

const typeConfig: Record<Notification['type'], { icon: ReactNode; color: string }> = {
  gig_match: { icon: <MapPin className="w-3.5 h-3.5" />, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10' },
  gig_application: { icon: <User className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
  application_accepted: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' },
  application_rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' },
  escrow_held: { icon: <Shield className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10' },
  escrow_released: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' },
  escrow_refund: { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10' },
  payment_received: { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10' },
  gig_completed: { icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' },
  gig_completion_pending: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10' },
  gig_redo: { icon: <RotateCcw className="w-3.5 h-3.5" />, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10' },
};

export function NotificationsPanel({ notifications, unreadCount, onMarkRead, onMarkAllRead, onApprovePayment, onRequestRedo, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-sm bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full animate-slide-in-right">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && <span className="px-1.5 py-0.5 text-[10px] bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-full font-medium">{unreadCount}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"><XCircle className="w-4 h-4 text-gray-400" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10"><Bell className="w-10 h-10 text-gray-200 dark:text-gray-700 mx-auto mb-2" /><p className="text-xs text-gray-400">No notifications yet</p></div>
          ) : (
            notifications.map((notif) => {
              const config = typeConfig[notif.type];
              return (
                <div key={notif.id} onClick={() => { if (!notif.is_read) onMarkRead(notif.id); }}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    notif.is_read ? 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
                  }`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${config.color}`}>{config.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-medium text-gray-900 dark:text-white">{notif.title}</h4>
                      {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{notif.body}</p>
                    {notif.type === 'gig_completion_pending' && notif.reference_id && (onApprovePayment || onRequestRedo) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {onApprovePayment && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onApprovePayment(notif.reference_id!); }}
                            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-semibold rounded-md transition-colors"
                          >
                            Finish & Pay
                          </button>
                        )}
                        {onRequestRedo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRequestRedo(notif.reference_id!); }}
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold rounded-md transition-colors"
                          >
                            Request Redo
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
