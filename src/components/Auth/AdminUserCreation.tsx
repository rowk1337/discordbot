import React, { useState } from 'react';
import { UserPlus, Mail, Shield, User, Copy, CheckCircle, AlertCircle, RefreshCw, Link, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendSetupEmail } from '../../lib/emailService';

interface AdminUserCreationProps {
  onUserCreated?: () => void;
}

const AdminUserCreation: React.FC<AdminUserCreationProps> = ({ onUserCreated }) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [setupLinkCopied, setSetupLinkCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSetupUrl(null);
    setSetupLinkCopied(false);
    setIsLoading(true);

    try {
      // Use the RPC function to create a user with a temporary setup link
      const { data, error } = await supabase.rpc('create_user_with_temp_password', {
        user_email: formData.email,
        user_role: formData.role,
        user_name: formData.name || null,
        password_expiry_days: 7,
        password_length: 0 // We don't need a temporary password, just a setup link
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setSetupUrl(data.setup_url);
        
        // Attempt to send setup email (won't fail if email service is not configured)
        if (data.setup_url) {
          try {
            await sendSetupEmail(formData.email, data.setup_url, formData.name);
            setSuccess(`User ${formData.email} created successfully! Setup email queued for sending.`);
          } catch (emailError) {
            console.warn("Email sending failed:", emailError);
            setSuccess(`User ${formData.email} created successfully! Please share the setup link manually.`);
          }
        } else {
          setSuccess(`User ${formData.email} created successfully!`);
        }
        
        setFormData({
          email: '',
          name: '',
          role: 'user',
        });
        if (onUserCreated) {
          onUserCreated();
        }
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      setError(`Error creating user: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSetupLinkCopied(true);
    setTimeout(() => setSetupLinkCopied(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <UserPlus size={20} className="mr-2 text-blue-600" />
        Create New User
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle size={18} className="text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle size={18} className="text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {setupUrl && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-300 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center">
            <Link size={18} className="mr-2" />
            Password Setup Link (Copy and share with user)
          </h4>
          <div className="flex items-center bg-white border border-blue-200 rounded p-2 mb-2">
            <input 
              type="text" 
              value={setupUrl} 
              readOnly 
              className="flex-1 text-sm text-blue-900 font-mono px-2 py-1 bg-transparent border-none focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(setupUrl)}
              className="ml-2 p-1.5 text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
              title="Copy to clipboard"
            >
              {setupLinkCopied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div className="flex items-start bg-amber-50 border border-amber-200 rounded p-2">
            <Info size={16} className="text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-amber-700 text-xs">
              <strong>Important:</strong> Share this link with the user so they can set their password.
              This link will expire in 7 days. Email service is not fully configured, so please share this link manually.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name (Optional)
          </label>
          <div className="relative">
            <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User Role
          </label>
          <div className="relative">
            <Shield size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="user">Regular User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Administrators have full access to all features including user management.
          </p>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Creating User...
              </>
            ) : (
              <>
                <UserPlus size={18} className="mr-2" />
                Create User with Setup Link
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>A secure setup link will be generated for the user to set their password.</p>
        <p>The link will expire after 7 days if unused.</p>
        <p className="text-amber-600 mt-1">Note: Email service requires additional configuration for automatic sending.</p>
      </div>
    </div>
  );
};

export default AdminUserCreation;