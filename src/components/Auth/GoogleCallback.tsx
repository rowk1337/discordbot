import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { googleAuth } from '../../lib/googleAuth';

const GoogleCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Erreur OAuth: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Paramètres OAuth manquants');
        }

        setMessage('Connexion à Google en cours...');
        
        const result = await googleAuth.handleCallback(code, state);
        
        setStatus('success');
        setMessage(`Connexion réussie ! Bienvenue ${result.name}`);
        
        // Rediriger vers l'application principale après 2 secondes
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
        
      } catch (error) {
        console.error('Erreur lors du callback Google:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
        
        // Rediriger vers l'application principale après 3 secondes
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader size={48} className="mx-auto mb-4 text-blue-600 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connexion en cours...
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connexion réussie !
            </h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirection automatique vers l'application...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Erreur de connexion
            </h2>
            <p className="text-red-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirection automatique vers l'application...
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retourner à l'application
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;