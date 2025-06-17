import { ReminderTemplate } from '../types';

interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: 'numeroFacture',
    label: 'Numéro de facture',
    description: 'Le numéro unique de la facture',
    example: 'FAC2024-001'
  },
  {
    key: 'montantTotal',
    label: 'Montant total',
    description: 'Le montant total de la facture',
    example: '1 500,00 €'
  },
  {
    key: 'soldeRestant',
    label: 'Solde restant',
    description: 'Le montant restant à payer',
    example: '750,00 €'
  },
  {
    key: 'dateFacture',
    label: 'Date de facture',
    description: 'La date d\'émission de la facture',
    example: '15/01/2024'
  },
  {
    key: 'dateEcheance',
    label: 'Date d\'échéance',
    description: 'La date limite de paiement',
    example: '15/02/2024'
  },
  {
    key: 'joursRetard',
    label: 'Jours de retard',
    description: 'Le nombre de jours de retard',
    example: '15'
  },
  {
    key: 'nomClient',
    label: 'Nom du client',
    description: 'Le nom ou raison sociale du client',
    example: 'Société ABC'
  },
  {
    key: 'nomSociete',
    label: 'Nom de la société',
    description: 'Le nom de votre société',
    example: 'Ma Société'
  },
  {
    key: 'adresseSociete',
    label: 'Adresse de la société',
    description: 'L\'adresse complète de votre société',
    example: '123 Rue de la Paix, 75001 Paris'
  },
  {
    key: 'telephoneSociete',
    label: 'Téléphone de la société',
    description: 'Le numéro de téléphone de votre société',
    example: '01 23 45 67 89'
  },
  {
    key: 'emailSociete',
    label: 'Email de la société',
    description: 'L\'adresse email de votre société',
    example: 'contact@masociete.fr'
  },
  {
    key: 'dateAujourdhui',
    label: 'Date d\'aujourd\'hui',
    description: 'La date actuelle',
    example: '01/03/2024'
  }
];

export class EmailTemplateEngine {
  // Remplacer les variables dans un texte
  static replaceVariables(
    text: string, 
    variables: Record<string, any>,
    companyInfo?: {
      name: string;
      address?: string;
      phone?: string;
      email?: string;
    }
  ): string {
    let result = text;
    
    // Variables de base
    const replacements: Record<string, string> = {
      numeroFacture: variables.numeroFacture || '',
      montantTotal: this.formatCurrency(variables.montantTotal || 0),
      soldeRestant: this.formatCurrency(variables.soldeRestant || 0),
      dateFacture: this.formatDate(variables.dateFacture),
      dateEcheance: this.formatDate(variables.dateEcheance),
      joursRetard: variables.joursRetard?.toString() || '0',
      nomClient: variables.nomClient || '',
      // CORRECTION: Utiliser le nom de la société depuis companyInfo ou une valeur par défaut
      nomSociete: companyInfo?.name || variables.nomSociete || 'Votre Société',
      adresseSociete: companyInfo?.address || '',
      telephoneSociete: companyInfo?.phone || '',
      emailSociete: companyInfo?.email || '',
      dateAujourdhui: this.formatDate(new Date().toISOString())
    };
    
    // Remplacer toutes les variables
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    
    return result;
  }

  // Valider un modèle
  static validateTemplate(template: Partial<ReminderTemplate>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!template.name?.trim()) {
      errors.push('Le nom du modèle est requis');
    }
    
    if (!template.subject?.trim()) {
      errors.push('L\'objet de l\'email est requis');
    }
    
    if (!template.content?.trim()) {
      errors.push('Le contenu de l\'email est requis');
    }
    
    if (!template.type) {
      errors.push('Le type de relance est requis');
    }
    
    if (!template.daysAfterDue || template.daysAfterDue < 1) {
      errors.push('Le nombre de jours après échéance doit être supérieur à 0');
    }
    
    // Vérifier les variables utilisées
    const usedVariables = this.extractVariables(template.subject + ' ' + template.content);
    const invalidVariables = usedVariables.filter(
      variable => !TEMPLATE_VARIABLES.some(tv => tv.key === variable)
    );
    
    if (invalidVariables.length > 0) {
      errors.push(`Variables inconnues: ${invalidVariables.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Extraire les variables d'un texte
  static extractVariables(text: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  // Prévisualiser un modèle avec des données d'exemple
  static previewTemplate(
    template: Pick<ReminderTemplate, 'subject' | 'content'>,
    companyInfo?: { name: string; address?: string; phone?: string; email?: string }
  ): { subject: string; content: string } {
    const exampleData = {
      numeroFacture: 'FAC2024-001',
      montantTotal: 1500,
      soldeRestant: 750,
      dateFacture: '2024-01-15',
      dateEcheance: '2024-02-15',
      joursRetard: 15,
      nomClient: 'Société ABC'
    };
    
    return {
      subject: this.replaceVariables(template.subject, exampleData, companyInfo),
      content: this.replaceVariables(template.content, exampleData, companyInfo)
    };
  }

  // CORRECTION: Générer un modèle HTML à partir du contenu texte avec gestion des sauts de ligne
  static generateHtmlContent(textContent: string): string {
    // Convertir les retours à la ligne en <br> et préserver les paragraphes
    let html = textContent
      .replace(/\r\n/g, '\n') // Normaliser les retours à la ligne
      .replace(/\r/g, '\n')   // Normaliser les retours à la ligne
      .split('\n\n')          // Séparer les paragraphes
      .map(paragraph => {
        // Convertir les sauts de ligne simples en <br> dans chaque paragraphe
        const formattedParagraph = paragraph
          .trim()
          .replace(/\n/g, '<br>');
        
        // Envelopper dans un paragraphe si ce n'est pas vide
        return formattedParagraph ? `<p>${formattedParagraph}</p>` : '';
      })
      .filter(p => p) // Supprimer les paragraphes vides
      .join('\n');
    
    // Ajouter une structure HTML de base
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relance de paiement</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .email-container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #3B82F6;
            padding-bottom: 20px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            color: #3B82F6;
            margin: 0;
            font-size: 24px;
        }
        .content {
            margin-bottom: 30px;
        }
        .content p {
            margin-bottom: 15px;
            line-height: 1.6;
        }
        .footer {
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
        }
        .highlight {
            background-color: #fef3c7;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .signature {
            margin-top: 20px;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Relance de paiement</h1>
        </div>
        <div class="content">
            ${html}
        </div>
        <div class="footer">
            <p>Ce message a été envoyé automatiquement par notre système de gestion.</p>
            <p>Pour toute question, n'hésitez pas à nous contacter.</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Formater une devise
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  // Formater une date
  private static formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR');
  }
}

// Modèles par défaut
export const DEFAULT_TEMPLATES: Omit<ReminderTemplate, 'id'>[] = [
  {
    name: 'Première relance - Courtoise',
    subject: 'Rappel amical - Facture {{numeroFacture}}',
    content: `Bonjour,

Nous espérons que vous allez bien.

Nous souhaitons attirer votre attention sur la facture {{numeroFacture}} d'un montant de {{montantTotal}}, émise le {{dateFacture}} et échue le {{dateEcheance}}.

Le solde restant à régler est de {{soldeRestant}}.

Il est possible que cette facture ait été réglée récemment et que nos systèmes ne soient pas encore à jour. Dans ce cas, nous vous prions d'excuser ce rappel.

Si ce n'est pas le cas, nous vous serions reconnaissants de bien vouloir procéder au règlement dans les plus brefs délais.

Nous vous remercions de votre confiance et restons à votre disposition pour tout renseignement.

Cordialement,
{{nomSociete}}`,
    type: 'first_reminder',
    daysAfterDue: 7,
    isActive: true
  },
  {
    name: 'Deuxième relance - Ferme',
    subject: 'URGENT - Facture {{numeroFacture}} en retard de {{joursRetard}} jours',
    content: `Madame, Monsieur,

Malgré notre précédent courrier, nous constatons que la facture {{numeroFacture}} d'un montant de {{montantTotal}} n'a toujours pas été réglée.

Cette facture, émise le {{dateFacture}} et échue le {{dateEcheance}}, est maintenant en retard de {{joursRetard}} jours.

Le solde restant à régler est de {{soldeRestant}}.

Nous vous demandons de régulariser cette situation dans les 8 jours suivant la réception de ce courrier, faute de quoi nous nous verrions contraints d'engager une procédure de recouvrement.

Nous espérons que cette situation trouvera rapidement une solution et restons à votre disposition.

Cordialement,
{{nomSociete}}
{{adresseSociete}}
{{telephoneSociete}}`,
    type: 'second_reminder',
    daysAfterDue: 15,
    isActive: true
  },
  {
    name: 'Mise en demeure - Formelle',
    subject: 'MISE EN DEMEURE - Facture {{numeroFacture}} - {{nomClient}}',
    content: `MISE EN DEMEURE

Madame, Monsieur,

Par la présente, nous vous mettons en demeure de procéder au règlement de la facture {{numeroFacture}} d'un montant de {{montantTotal}}, émise le {{dateFacture}} et échue depuis le {{dateEcheance}}.

Cette facture est maintenant en retard de {{joursRetard}} jours.

Le solde restant à régler est de {{soldeRestant}}.

Malgré nos précédentes relances, cette créance demeure impayée.

Nous vous accordons un délai de 8 jours à compter de la réception de cette mise en demeure pour procéder au règlement intégral de cette somme.

À défaut de règlement dans ce délai, nous nous verrons contraints, à notre grand regret, d'engager contre vous une procédure de recouvrement contentieux, avec toutes les conséquences que cela implique, notamment :

- Majoration de la créance des intérêts de retard
- Frais de recouvrement
- Éventuelle inscription aux fichiers d'incidents de paiement

Nous espérons vivement qu'il ne sera pas nécessaire d'en arriver à cette extrémité et que vous donnerez une suite favorable à cette mise en demeure.

Fait le {{dateAujourdhui}}

{{nomSociete}}
{{adresseSociete}}
{{telephoneSociete}}
{{emailSociete}}`,
    type: 'final_notice',
    daysAfterDue: 30,
    isActive: true
  }
];