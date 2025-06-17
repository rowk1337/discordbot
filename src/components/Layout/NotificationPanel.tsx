import React, { useRef, useEffect } from 'react';
import { X, Bell, CreditCard, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

interface NotificationPanelProps {
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose, triggerRef }) => {
  const { notifications, markNotificationAsRead } = useData();
  const panelRef = useRef<HTMLDivElement>(null);
  
  const recentNotifications = notifications
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, triggerRef]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment': return <CreditCard size={20} className="text-green-500" />;
      case 'reminder': return <Clock size={20} className="text-orange-500" />;
      case 'warning': return <AlertTriangle size={20} className="text-red-500" />;
      case 'invoice': return <CheckCircle size={20} className="text-blue-500" />;
      default: return <Bell size={20} className="text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'À l\'instant';
    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
    if (diffInHours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR');
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read) {
      markNotificationAsRead(notification.id);
    }
  };

  // Calculer la position du panneau par rapport au bouton de notification
  const getPosition = () => {
    if (!triggerRef.current) return { top: '4rem', left: '17rem' };
    
    const rect = triggerRef.current.getBoundingClientRect();
    return {
      top: `${rect.bottom + 8}px`,
      left: `${rect.left - 320}px` // Position à gauche du bouton avec la largeur du panneau
    };
  };

  const position = getPosition();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div 
        ref={panelRef}
        className="absolute bg-white rounded-xl shadow-xl w-96 max-h-[80vh] overflow-hidden border border-gray-200 pointer-events-auto"
        style={position}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Bell size={20} className="mr-2" />
            Notifications
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Bell size={48} className="mx-auto mb-3 text-gray-300" />
              <p>Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${
                          !notification.read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDate(notification.date)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {recentNotifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium">
              Voir toutes les notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;