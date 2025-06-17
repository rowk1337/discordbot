import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PasswordSetupFormProps {
  token: string;
  onSuccess: () => void;
}

const PasswordSetupForm: React.FC<PasswordSetupFormProps> = ({ token, onSuccess }) => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [] as string[]
  });

  useEffect(() => {
    // Vérifier le token et récupérer les informations utilisateur
    verifyToken();
  }, [token]);

  useEffect(() => {
    // Évaluer la force du mot de passe
    evaluatePasswordStrength(formData.password);
  }, [formData.password]);

  const verifyToken = async () => {
    try {
      const { data, error } = await supabase.rpc('verify_password_setup_token', {
        setup_token: token
      });

      if (error) {
        setError('Token invalide ou expiré. Veuillez demander un nouveau lien.');
        return;
      }

      if (data.success) {
        setUserEmail(data.email);
      } else {
        setError(data.error || 'Token invalide');
      }
    } catch (error: any) {
      setError('Erreur lors de la vérification du token');
    }
  };

  const evaluatePasswordStrength = (password: string) => {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('Au moins 8 caractères');
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Au moins une lettre minuscule');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Au moins une lettre majuscule');
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('Au moins un chiffre');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('Au moins un caractère spécial');
    }

    setPasswordStrength({ score, feedback });
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 2) return 'bg-red-500';
    if (passwordStrength.score <= 3) return 'bg-orange-500';
    if (passwordStrength.score <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 2) return 'Faible';
    if (passwordStrength.score <= 3) return 'Moyen';
    if (passwordStrength.score <= 4) return 'Bon';
    return 'Excellent';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validations
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Le mot de passe doit être plus fort. Veuillez suivre les recommandations.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('setup_user_password', {
        setup_token: token,
        new_password: formData.password
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setSuccess('Mot de passe défini avec succès ! Vous pouvez maintenant vous connecter.');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Erreur lors de la définition du mot de passe');
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la définition du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!userEmail && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Vérification du lien...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Key size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Définir votre mot de passe</h1>
          <p className="text-slate-400">
            Bienvenue ! Veuillez définir un mot de passe sécurisé pour votre compte.
          </p>
          {userEmail && (
            <p className="text-blue-300 mt-2 text-sm">
              Compte : {userEmail}
            </p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6">
              <div className="flex items-start">
                <AlertCircle size={20} className="text-red-300 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-6">
              <div className="flex items-start">
                <CheckCircle size={20} className="text-green-300 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nouveau mot de passe */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Votre nouveau mot de passe"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Indicateur de force du mot de passe */}
              {formData.password && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Force du mot de passe</span>
                    <span className="text-sm text-slate-300">{getPasswordStrengthText()}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400 mb-1">Améliorations suggérées :</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-1 h-1 bg-slate-400 rounded-full mr-2" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation du mot de passe */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirmez votre mot de passe"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-red-300 text-sm mt-2">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Conseils de sécurité */}
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
              <h4 className="text-blue-300 font-medium mb-2">Conseils pour un mot de passe sécurisé :</h4>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• Au moins 8 caractères</li>
                <li>• Mélange de majuscules et minuscules</li>
                <li>• Au moins un chiffre</li>
                <li>• Au moins un caractère spécial (!@#$%^&*)</li>
                <li>• Évitez les mots du dictionnaire</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isLoading || passwordStrength.score < 3 || formData.password !== formData.confirmPassword}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <Key size={20} className="mr-2" />
                  Définir le mot de passe
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Une fois votre mot de passe défini, vous pourrez vous connecter normalement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PasswordSetupForm;