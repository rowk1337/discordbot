import { supabase } from './supabase';

export interface GoogleAuthState {
  isConnected: boolean;
  email?: string;
  name?: string;
  picture?: string;
  connectedAt?: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private currentUser: any = null;
  private authStateCache: GoogleAuthState | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  // Vider le cache
  private clearCache(): void {
    this.authStateCache = null;
    this.cacheExpiry = 0;
  }

  // Vérifier si le cache est valide
  private isCacheValid(): boolean {
    return this.authStateCache !== null && Date.now() < this.cacheExpiry;
  }

  // Générer un state sécurisé pour CSRF protection
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Stocker le state dans le sessionStorage
  private storeState(state: string): void {
    sessionStorage.setItem('google_oauth_state', state);
  }

  // Vérifier le state
  private verifyState(state: string): boolean {
    const storedState = sessionStorage.getItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_state');
    return storedState === state;
  }

  // Initier la connexion Google
  async initiateLogin(): Promise<void> {
    try {
      // Vérifier que l'utilisateur est connecté à Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      this.currentUser = user;

      // Générer un state sécurisé
      const state = this.generateState();
      this.storeState(state);

      // Appeler la fonction Edge pour obtenir l'URL d'autorisation
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération de l\'URL d\'autorisation');
      }

      const { authUrl } = await response.json();
      
      // Rediriger vers Google
      window.location.href = authUrl;
    } catch (error) {
      console.error('Erreur lors de l\'initiation de la connexion Google:', error);
      throw error;
    }
  }

  // Gérer le callback OAuth
  async handleCallback(code: string, state: string): Promise<GoogleAuthState> {
    try {
      // Vérifier le state pour la sécurité CSRF
      if (!this.verifyState(state)) {
        throw new Error('State invalide - possible attaque CSRF');
      }

      // Vérifier que l'utilisateur est connecté à Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      // Appeler la fonction Edge pour traiter le callback
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code, 
          state, 
          userId: user.id 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'authentification');
      }

      const result = await response.json();
      
      const authState: GoogleAuthState = {
        isConnected: true,
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        connectedAt: new Date().toISOString()
      };

      // Mettre à jour le cache
      this.authStateCache = authState;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      return authState;
    } catch (error) {
      console.error('Erreur lors du callback OAuth:', error);
      this.clearCache();
      throw error;
    }
  }

  // Déconnecter Google
  async disconnect(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la déconnexion');
      }

      // Vider le cache
      this.clearCache();
    } catch (error) {
      console.error('Erreur lors de la déconnexion Google:', error);
      this.clearCache();
      throw error;
    }
  }

  // Obtenir le profil utilisateur avec cache intelligent
  async getProfile(): Promise<GoogleAuthState | null> {
    try {
      // Vérifier le cache d'abord
      if (this.isCacheValid()) {
        return this.authStateCache;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.clearCache();
        return null;
      }

      // Récupérer depuis la base de données
      const { data: settings, error } = await supabase
        .from('app_settings')
        .select('google_integration_settings')
        .eq('user_id', user.id)
        .single();

      if (error || !settings?.google_integration_settings?.isConnected) {
        this.clearCache();
        return { isConnected: false };
      }

      const googleSettings = settings.google_integration_settings;
      
      // Vérifier si le jeton a expiré
      const now = new Date();
      const expiresAt = new Date(googleSettings.expiresAt || 0);
      
      if (now > expiresAt && googleSettings.refreshToken) {
        try {
          // Rafraîchir le jeton automatiquement
          await this.refreshToken();
          // Récupérer les nouvelles données après rafraîchissement
          const { data: updatedSettings } = await supabase
            .from('app_settings')
            .select('google_integration_settings')
            .eq('user_id', user.id)
            .single();
          
          if (updatedSettings?.google_integration_settings) {
            const authState: GoogleAuthState = {
              isConnected: true,
              email: updatedSettings.google_integration_settings.email,
              name: updatedSettings.google_integration_settings.name,
              picture: updatedSettings.google_integration_settings.picture,
              connectedAt: updatedSettings.google_integration_settings.connectedAt
            };
            
            // Mettre à jour le cache
            this.authStateCache = authState;
            this.cacheExpiry = Date.now() + this.CACHE_DURATION;
            
            return authState;
          }
        } catch (refreshError) {
          console.error('Erreur lors du rafraîchissement automatique:', refreshError);
          // Si le rafraîchissement échoue, considérer comme déconnecté
          this.clearCache();
          return { isConnected: false };
        }
      }

      const authState: GoogleAuthState = {
        isConnected: true,
        email: googleSettings.email,
        name: googleSettings.name,
        picture: googleSettings.picture,
        connectedAt: googleSettings.connectedAt
      };

      // Mettre à jour le cache
      this.authStateCache = authState;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      return authState;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      this.clearCache();
      return { isConnected: false };
    }
  }

  // Rafraîchir le jeton d'accès
  async refreshToken(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth?action=refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        throw new Error('Erreur lors du rafraîchissement du jeton');
      }

      // Vider le cache pour forcer un rechargement
      this.clearCache();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du jeton:', error);
      this.clearCache();
      throw error;
    }
  }

  // Envoyer un email via Gmail
  async sendEmail(
    to: string,
    subject: string,
    content: string,
    options?: {
      invoiceId?: string;
      clientId?: string;
      templateId?: string;
    }
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      // Vérifier que Google est connecté
      const profile = await this.getProfile();
      if (!profile?.isConnected) {
        throw new Error('Compte Google non connecté');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          to,
          subject,
          content,
          ...options
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'envoi d\'email');
      }

      const result = await response.json();
      return result.messageId;
    } catch (error) {
      console.error('Erreur lors de l\'envoi d\'email:', error);
      throw error;
    }
  }

  // Forcer la synchronisation avec la base de données
  async forceSync(): Promise<GoogleAuthState | null> {
    this.clearCache();
    return await this.getProfile();
  }
}

// Instance singleton
export const googleAuth = GoogleAuthService.getInstance();