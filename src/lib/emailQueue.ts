import { supabase } from './supabase';
import { googleAuth } from './googleAuth';

export interface EmailJob {
  id: string;
  userId: string;
  to: string;
  subject: string;
  content: string;
  priority: 'low' | 'normal' | 'high';
  maxRetries: number;
  currentRetries: number;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: string;
  processedAt?: string;
  errorMessage?: string;
  metadata?: {
    invoiceId?: string;
    clientId?: string;
    templateId?: string;
    type?: 'reminder' | 'notification' | 'manual';
  };
}

interface EmailError {
  type: 'network' | 'authentication' | 'quota' | 'validation' | 'server' | 'unknown';
  code?: string;
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

export class EmailQueue {
  private static instance: EmailQueue;
  private isProcessing = false;
  private processingInterval: number | null = null;
  private readonly BATCH_SIZE = 5;
  private readonly PROCESS_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [60, 300, 900]; // 1min, 5min, 15min

  private constructor() {
    this.startProcessing();
  }

  static getInstance(): EmailQueue {
    if (!EmailQueue.instance) {
      EmailQueue.instance = new EmailQueue();
    }
    return EmailQueue.instance;
  }

  // Ajouter un email à la file d'attente
  async addEmail(emailData: {
    to: string;
    subject: string;
    content: string;
    priority?: 'low' | 'normal' | 'high';
    scheduledAt?: Date;
    metadata?: EmailJob['metadata'];
  }): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const { data, error } = await supabase
        .from('email_logs')
        .insert({
          user_id: user.id,
          recipient_email: emailData.to,
          subject: emailData.subject,
          content: emailData.content,
          status: 'pending',
          invoice_id: emailData.metadata?.invoiceId,
          client_id: emailData.metadata?.clientId,
          template_id: emailData.metadata?.templateId
        })
        .select()
        .single();

      if (error) throw error;

      // Créer l'entrée dans la file d'attente
      await this.createQueueEntry({
        id: data.id,
        userId: user.id,
        to: emailData.to,
        subject: emailData.subject,
        content: emailData.content,
        priority: emailData.priority || 'normal',
        maxRetries: this.MAX_RETRIES,
        currentRetries: 0,
        status: 'pending',
        scheduledAt: emailData.scheduledAt?.toISOString(),
        metadata: emailData.metadata
      });

      return data.id;
    } catch (error) {
      console.error('Erreur lors de l\'ajout à la file d\'attente:', error);
      throw error;
    }
  }

  // Traiter la file d'attente
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    
    try {
      const pendingJobs = await this.getPendingJobs();
      
      for (const job of pendingJobs.slice(0, this.BATCH_SIZE)) {
        await this.processJob(job);
      }
    } catch (error) {
      console.error('Erreur lors du traitement de la file d\'attente:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Traiter un job individuel
  private async processJob(job: EmailJob): Promise<void> {
    try {
      // Marquer comme en cours de traitement
      await this.updateJobStatus(job.id, 'processing');

      // Vérifier si l'email est programmé pour plus tard
      if (job.scheduledAt && new Date(job.scheduledAt) > new Date()) {
        await this.updateJobStatus(job.id, 'pending');
        return;
      }

      // Envoyer l'email
      const messageId = await googleAuth.sendEmail(
        job.to,
        job.subject,
        job.content,
        {
          invoiceId: job.metadata?.invoiceId,
          clientId: job.metadata?.clientId,
          templateId: job.metadata?.templateId
        }
      );

      // Marquer comme envoyé
      await this.updateJobStatus(job.id, 'sent', undefined, messageId);
      
      // Créer une notification de succès
      await this.createNotification(job.userId, {
        type: 'email_sent',
        title: 'Email envoyé avec succès',
        message: `Email envoyé à ${job.to}: ${job.subject}`,
        level: 'success'
      });

    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  // Gérer les erreurs de job
  private async handleJobError(job: EmailJob, error: any): Promise<void> {
    const emailError = this.classifyError(error);
    
    console.error(`Erreur lors de l'envoi d'email (Job ${job.id}):`, {
      error: emailError,
      job: job
    });

    if (emailError.retryable && job.currentRetries < job.maxRetries) {
      // Programmer un nouveau essai
      const retryDelay = this.RETRY_DELAYS[job.currentRetries] || 900;
      const nextRetry = new Date(Date.now() + retryDelay * 1000);
      
      await this.scheduleRetry(job.id, nextRetry, job.currentRetries + 1, emailError.message);
      
      // Notification de retry
      await this.createNotification(job.userId, {
        type: 'email_retry',
        title: 'Nouvel essai d\'envoi programmé',
        message: `L'envoi de l'email à ${job.to} sera retenté dans ${Math.round(retryDelay / 60)} minutes`,
        level: 'warning'
      });
    } else {
      // Marquer comme échoué définitivement
      await this.updateJobStatus(job.id, 'failed', emailError.message);
      
      // Notification d'échec critique
      await this.createNotification(job.userId, {
        type: 'email_failed',
        title: 'Échec d\'envoi d\'email',
        message: `Impossible d'envoyer l'email à ${job.to}: ${emailError.message}`,
        level: 'error'
      });

      // Si c'est une erreur critique, notifier l'administrateur
      if (emailError.type === 'authentication' || emailError.type === 'quota') {
        await this.notifyAdministrator(emailError, job);
      }
    }
  }

  // Classifier les erreurs
  private classifyError(error: any): EmailError {
    const message = error.message || error.toString();
    
    // Erreurs d'authentification
    if (message.includes('unauthorized') || message.includes('invalid_grant') || message.includes('token')) {
      return {
        type: 'authentication',
        message: 'Erreur d\'authentification Google. Veuillez reconnecter votre compte.',
        retryable: false
      };
    }
    
    // Erreurs de quota
    if (message.includes('quota') || message.includes('rate limit') || message.includes('429')) {
      return {
        type: 'quota',
        message: 'Limite de quota Gmail atteinte. Réessai automatique dans quelques minutes.',
        retryable: true,
        retryAfter: 300 // 5 minutes
      };
    }
    
    // Erreurs réseau
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return {
        type: 'network',
        message: 'Erreur de connexion réseau. Réessai automatique.',
        retryable: true
      };
    }
    
    // Erreurs de validation
    if (message.includes('invalid email') || message.includes('validation')) {
      return {
        type: 'validation',
        message: 'Adresse email invalide ou contenu non valide.',
        retryable: false
      };
    }
    
    // Erreurs serveur
    if (message.includes('500') || message.includes('server error')) {
      return {
        type: 'server',
        message: 'Erreur serveur temporaire. Réessai automatique.',
        retryable: true
      };
    }
    
    // Erreur inconnue
    return {
      type: 'unknown',
      message: `Erreur inconnue: ${message}`,
      retryable: true
    };
  }

  // Méthodes utilitaires pour la base de données
  private async createQueueEntry(job: EmailJob): Promise<void> {
    // Stocker dans localStorage pour la simulation de file d'attente
    const queue = this.getQueueFromStorage();
    queue.push(job);
    localStorage.setItem('email_queue', JSON.stringify(queue));
  }

  private async getPendingJobs(): Promise<EmailJob[]> {
    const queue = this.getQueueFromStorage();
    const now = new Date();
    
    return queue
      .filter(job => 
        job.status === 'pending' && 
        (!job.scheduledAt || new Date(job.scheduledAt) <= now)
      )
      .sort((a, b) => {
        // Trier par priorité puis par date de création
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        return new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime();
      });
  }

  private async updateJobStatus(
    jobId: string, 
    status: EmailJob['status'], 
    errorMessage?: string,
    messageId?: string
  ): Promise<void> {
    // Mettre à jour dans la file d'attente locale
    const queue = this.getQueueFromStorage();
    const jobIndex = queue.findIndex(job => job.id === jobId);
    
    if (jobIndex !== -1) {
      queue[jobIndex].status = status;
      if (errorMessage) queue[jobIndex].errorMessage = errorMessage;
      if (status === 'processing' || status === 'sent' || status === 'failed') {
        queue[jobIndex].processedAt = new Date().toISOString();
      }
      localStorage.setItem('email_queue', JSON.stringify(queue));
    }

    // Mettre à jour dans Supabase
    const updateData: any = { status };
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
      if (messageId) updateData.google_message_id = messageId;
    }
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await supabase
      .from('email_logs')
      .update(updateData)
      .eq('id', jobId);
  }

  private async scheduleRetry(
    jobId: string, 
    nextRetry: Date, 
    retryCount: number, 
    errorMessage: string
  ): Promise<void> {
    const queue = this.getQueueFromStorage();
    const jobIndex = queue.findIndex(job => job.id === jobId);
    
    if (jobIndex !== -1) {
      queue[jobIndex].status = 'pending';
      queue[jobIndex].scheduledAt = nextRetry.toISOString();
      queue[jobIndex].currentRetries = retryCount;
      queue[jobIndex].errorMessage = errorMessage;
      localStorage.setItem('email_queue', JSON.stringify(queue));
    }
  }

  private async createNotification(
    userId: string, 
    notification: {
      type: string;
      title: string;
      message: string;
      level: 'success' | 'warning' | 'error';
    }
  ): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'email',
          title: notification.title,
          message: notification.message
        });
    } catch (error) {
      console.error('Erreur lors de la création de notification:', error);
    }
  }

  private async notifyAdministrator(error: EmailError, job: EmailJob): Promise<void> {
    console.error('ERREUR CRITIQUE - Notification administrateur:', {
      error,
      job,
      timestamp: new Date().toISOString()
    });
    
    // Ici vous pourriez implémenter l'envoi d'une notification à l'administrateur
    // par exemple via un webhook, Slack, ou email de secours
  }

  private getQueueFromStorage(): EmailJob[] {
    try {
      const queue = localStorage.getItem('email_queue');
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  // Démarrer le traitement automatique
  private startProcessing(): void {
    if (this.processingInterval) return;
    
    this.processingInterval = window.setInterval(() => {
      this.processQueue();
    }, this.PROCESS_INTERVAL);
    
    // Traitement initial
    setTimeout(() => this.processQueue(), 1000);
  }

  // Arrêter le traitement automatique
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Obtenir les statistiques de la file d'attente
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    const queue = this.getQueueFromStorage();
    
    return {
      pending: queue.filter(job => job.status === 'pending').length,
      processing: queue.filter(job => job.status === 'processing').length,
      sent: queue.filter(job => job.status === 'sent').length,
      failed: queue.filter(job => job.status === 'failed').length,
      total: queue.length
    };
  }

  // Nettoyer les anciens jobs
  async cleanupOldJobs(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const queue = this.getQueueFromStorage();
    
    const filteredQueue = queue.filter(job => {
      const jobDate = new Date(job.processedAt || job.scheduledAt || 0);
      return jobDate > cutoffDate || job.status === 'pending' || job.status === 'processing';
    });
    
    localStorage.setItem('email_queue', JSON.stringify(filteredQueue));
  }

  // Annuler un job
  async cancelJob(jobId: string): Promise<void> {
    await this.updateJobStatus(jobId, 'cancelled');
  }

  // Reprendre un job échoué
  async retryJob(jobId: string): Promise<void> {
    const queue = this.getQueueFromStorage();
    const jobIndex = queue.findIndex(job => job.id === jobId);
    
    if (jobIndex !== -1) {
      queue[jobIndex].status = 'pending';
      queue[jobIndex].currentRetries = 0;
      queue[jobIndex].errorMessage = undefined;
      queue[jobIndex].scheduledAt = new Date().toISOString();
      localStorage.setItem('email_queue', JSON.stringify(queue));
    }
  }
}

// Instance singleton
export const emailQueue = EmailQueue.getInstance();