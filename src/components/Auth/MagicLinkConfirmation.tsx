import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const MagicLinkConfirmation: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your login...');
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Get the hash from the URL
        const hash = window.location.hash;
        
        // If there's no hash, this isn't a magic link confirmation
        if (!hash) {
          setStatus('error');
          setMessage('Invalid magic link. Please request a new one.');
          return;
        }

        // Process the magic link confirmation
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (!data.session) {
          throw new Error('No session found. Please try again.');
        }

        // Check if the user needs to set up a password
        const needsPasswordSetup = new URLSearchParams(window.location.search).get('setup') === 'true' ||
                                  data.session.user.user_metadata?.needs_password_setup === true;

        setStatus('success');
        setMessage('Login successful! Redirecting...');

        // Redirect to the appropriate page
        setTimeout(() => {
          if (needsPasswordSetup) {
            navigate('/change-password');
          } else {
            navigate('/');
          }
        }, 2000);
      } catch (error) {
        console.error('Error confirming magic link:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred');
      }
    };

    handleConfirmation();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader size={48} className="mx-auto mb-4 text-blue-400 animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Confirming your login
            </h2>
            <p className="text-slate-300">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Login Successful!
            </h2>
            <p className="text-slate-300 mb-4">{message}</p>
            <div className="animate-pulse flex items-center justify-center text-blue-400">
              <span>Redirecting</span>
              <ArrowRight size={16} className="ml-2" />
            </div>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Login Failed
            </h2>
            <p className="text-red-300 mb-4">{message}</p>
            <button
              onClick={() => navigate('/magic-link')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MagicLinkConfirmation;