import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useData } from '../../contexts/DataContext';

const ImportTab: React.FC = () => {
  const { importInvoices, selectedCompany, clients, settings } = useData();
  const [dragActive, setDragActive] = useState(false);
  const [importData, setImportData] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error' | 'processing'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: number;
    errorMessages: string[];
  }>({ success: 0, errors: 0, errorMessages: [] });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          setImportData(content);
          parseImportData(content);
          setShowPreview(true);
          setImportStatus('idle');
        } else {
          setImportStatus('error');
          setImportMessage('Erreur lors de la lecture du fichier');
        }
      };
      reader.onerror = () => {
        setImportStatus('error');
        setImportMessage('Erreur lors de la lecture du fichier');
      };
      // Use windows-1252 encoding to handle French accented characters
      reader.readAsText(file, 'windows-1252');
    } else {
      setImportStatus('error');
      setImportMessage('Veuillez sélectionner un fichier .txt');
    }
  };

  const parseImportData = (content: string) => {
    try {
      // Check if content is valid
      if (!content || typeof content !== 'string') {
        setValidationErrors(['Contenu du fichier invalide ou vide']);
        setParsedData([]);
        return;
      }

      // Split content into lines
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        setValidationErrors(['Fichier vide ou aucune ligne valide trouvée']);
        setParsedData([]);
        return;
      }

      // Get header line and data lines
      const headerLine = lines[0];
      const dataLines = lines.slice(1);
      
      // Parse header to get column indices
      const headers = headerLine.split('\t');
      const getColumnIndex = (name: string) => {
        const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        return index !== -1 ? index : null;
      };
      
      // Get indices for required fields
      const compteTiersIndex = getColumnIndex('compte tiers');
      const debitIndex = getColumnIndex('débit');
      const dateIndex = getColumnIndex('date');
      const creditIndex = getColumnIndex('crédit');
      const numeroFactureIndex = getColumnIndex('facture');
      const modeReglementIndex = getColumnIndex('mode règlement');
      const dateEcheanceIndex = getColumnIndex('échéance');
      const montantRegleIndex = getColumnIndex('montant réglé');
      const libelleIndex = getColumnIndex('libellé');
      const referenceIndex = getColumnIndex('référence');
      const statutReglementIndex = getColumnIndex('statut règlement');
      const dateDernierReglementIndex = getColumnIndex('date dernier règlement');
      
      // Validate required columns
      const missingColumns = [];
      if (compteTiersIndex === null) missingColumns.push('Compte tiers');
      if (debitIndex === null && creditIndex === null) missingColumns.push('Débit ou Crédit');
      if (dateIndex === null) missingColumns.push('Date');
      if (numeroFactureIndex === null) missingColumns.push('N° facture');
      
      if (missingColumns.length > 0) {
        setValidationErrors([`Colonnes manquantes: ${missingColumns.join(', ')}`]);
        setParsedData([]);
        return;
      }
      
      // Parse data lines
      const parsedInvoices = [];
      const errors = [];
      const invoiceKeys = new Set(); // To track duplicates
      
      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        if (!line.trim()) continue;
        
        const columns = line.split('\t');
        
        // Skip if not enough columns
        if (columns.length < Math.max(
          compteTiersIndex || 0, 
          debitIndex || 0, 
          dateIndex || 0, 
          creditIndex || 0, 
          numeroFactureIndex || 0
        ) + 1) {
          errors.push(`Ligne ${i + 2}: Nombre de colonnes insuffisant`);
          continue;
        }
        
        // Get values
        const compteTiers = columns[compteTiersIndex!].trim();
        const debit = debitIndex !== null ? parseFloat(columns[debitIndex].replace(',', '.')) || 0 : 0;
        const credit = creditIndex !== null ? parseFloat(columns[creditIndex].replace(',', '.')) || 0 : 0;
        const date = columns[dateIndex!].trim();
        const numeroFacture = columns[numeroFactureIndex!].trim();
        const modeReglement = modeReglementIndex !== null ? columns[modeReglementIndex].trim() : '';
        const dateEcheance = dateEcheanceIndex !== null ? columns[dateEcheanceIndex].trim() : '';
        const montantRegle = montantRegleIndex !== null ? parseFloat(columns[montantRegleIndex].replace(',', '.')) || 0 : 0;
        const libelle = libelleIndex !== null ? columns[libelleIndex].trim() : `Facture ${numeroFacture}`;
        const reference = referenceIndex !== null ? columns[referenceIndex].trim() : '';
        const statutReglement = statutReglementIndex !== null ? columns[statutReglementIndex].trim() : '';
        const dateDernierReglement = dateDernierReglementIndex !== null ? columns[dateDernierReglementIndex].trim() : '';
        
        // Validate required fields
        if (!compteTiers) {
          errors.push(`Ligne ${i + 2}: Compte tiers manquant`);
          continue;
        }
        
        if (!numeroFacture) {
          errors.push(`Ligne ${i + 2}: Numéro de facture manquant`);
          continue;
        }
        
        if (!date) {
          errors.push(`Ligne ${i + 2}: Date manquante`);
          continue;
        }
        
        if (debit === 0 && credit === 0) {
          errors.push(`Ligne ${i + 2}: Montant (débit ou crédit) manquant`);
          continue;
        }
        
        // Check for duplicates
        const invoiceKey = `${selectedCompany}-${numeroFacture}`;
        if (invoiceKeys.has(invoiceKey)) {
          errors.push(`Ligne ${i + 2}: Facture ${numeroFacture} en doublon, ignorée`);
          continue;
        }
        invoiceKeys.add(invoiceKey);
        
        // Find existing client
        const existingClient = clients.find(c => c.compteTiers === compteTiers && c.companyId === selectedCompany);
        
        // Determine client type based on existing client or compte tiers
        let clientType = 'externe';
        if (existingClient) {
          clientType = existingClient.type;
        } else if (compteTiers.toLowerCase().includes('int')) {
          clientType = 'interne';
        } else if (compteTiers.toLowerCase().includes('part')) {
          clientType = 'partenaire';
        }
        
        // Generate client name from existing client or compte tiers
        const clientName = existingClient ? existingClient.name : compteTiers;
        
        // Determine if this is a credit note (Facture Avoir)
        const isAvoir = credit > 0 && debit === 0;
        
        // Determine montant total and solde restant
        let montantTotal = isAvoir ? -credit : debit;
        const soldeRestant = montantTotal - montantRegle;
        
        // Determine statut reglement
        let finalStatutReglement = 'non_regle';
        if (montantRegle >= Math.abs(montantTotal)) {
          finalStatutReglement = 'regle';
        } else if (montantRegle > 0) {
          finalStatutReglement = 'partiel';
        }
        
        // Format dates
        const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          
          // Try to parse DD/MM/YYYY format
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          
          // Try to parse YYYY-MM-DD format
          if (dateStr.includes('-')) {
            return dateStr;
          }
          
          // Try to parse DD/MM/YY format
          if (dateStr.includes('/') && dateStr.length === 8) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const year = parseInt(parts[2]) < 50 ? `20${parts[2]}` : `19${parts[2]}`;
              return `${year}-${parts[1]}-${parts[0]}`;
            }
          }
          
          return dateStr;
        };
        
        const formattedDate = formatDate(date);
        let formattedEcheanceDate = formatDate(dateEcheance);
        
        // Apply default payment terms if needed
        if (!formattedEcheanceDate || formattedEcheanceDate === formattedDate) {
          // Use client's default payment terms if client exists
          const defaultDays = existingClient 
            ? settings.clientTypeSettings?.[clientType]?.defaultPaymentDays 
            : settings.clientTypeSettings?.[clientType]?.defaultPaymentDays || 
              (clientType === 'externe' ? 30 : clientType === 'interne' ? 15 : 60);
          
          const dateObj = new Date(formattedDate);
          dateObj.setDate(dateObj.getDate() + defaultDays);
          formattedEcheanceDate = dateObj.toISOString().split('T')[0];
        }
        
        // Apply default payment mode if needed
        let finalModeReglement = modeReglement;
        if (!finalModeReglement || finalModeReglement === 'Aucun') {
          finalModeReglement = settings.clientTypeSettings?.[clientType]?.defaultPaymentMode || 'Virement';
        }
        
        // Create invoice object
        parsedInvoices.push({
          companyId: selectedCompany,
          compteTiers,
          clientName,
          clientType,
          date: formattedDate,
          numeroFacture,
          reference,
          libelleEcriture: libelle,
          modeReglement: finalModeReglement,
          dateEcheance: formattedEcheanceDate,
          statutReglement: finalStatutReglement,
          montantRegle,
          dateDernierReglement: formatDate(dateDernierReglement),
          positionReglement: montantRegle >= Math.abs(montantTotal) ? 'Soldé' : montantRegle > 0 ? 'Partiel' : 'En attente',
          montantARegler: montantTotal,
          quantiteARegler: 1,
          debit: isAvoir ? 0 : debit,
          avoir: isAvoir ? credit : 0,
          montantTotal,
          soldeRestant,
          isOverdue: new Date() > new Date(formattedEcheanceDate) && soldeRestant > 0
        });
      }
      
      setValidationErrors(errors);
      setParsedData(parsedInvoices);
      
    } catch (error) {
      console.error('Erreur lors du parsing:', error);
      setValidationErrors(['Erreur lors de l\'analyse du fichier. Vérifiez le format et l\'encodage.']);
      setParsedData([]);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setImportStatus('error');
      setImportMessage('Aucune donnée valide à importer');
      return;
    }
    
    setImportStatus('processing');
    setImportMessage('Import en cours...');
    setImportTotal(parsedData.length);
    setImportProgress(0);
    
    // Réinitialiser les résultats d'importation
    const results = {
      success: 0,
      errors: 0,
      errorMessages: [] as string[]
    };
    
    // Import invoices one by one to track progress
    for (let i = 0; i < parsedData.length; i++) {
      try {
        await importInvoices(parsedData[i]);
        results.success++;
      } catch (error) {
        results.errors++;
        const errorMessage = `Facture ${parsedData[i].numeroFacture}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        results.errorMessages.push(errorMessage);
        console.error(`Erreur lors de l'import de la facture ${parsedData[i].numeroFacture}:`, error);
      } finally {
        // Mettre à jour la progression même en cas d'erreur
        setImportProgress(i + 1);
      }
    }
    
    setImportResults(results);
    
    // Définir le statut final et le message
    if (results.errors === 0) {
      setImportStatus('success');
      setImportMessage(`Import réussi ! ${results.success} factures importées.`);
    } else if (results.success === 0) {
      setImportStatus('error');
      setImportMessage(`Échec de l'import. Aucune facture importée. ${results.errors} erreurs.`);
    } else {
      setImportStatus('success');
      setImportMessage(`Import terminé avec des avertissements. ${results.success} factures importées, ${results.errors} erreurs.`);
    }
    
    // Réinitialiser les données si au moins une facture a été importée avec succès
    if (results.success > 0) {
      setImportData('');
      setParsedData([]);
      setShowPreview(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'Code journal\tDate\tN° pièce\tN° facture\tRéférence\tN° compte général\tN° compte tiers\tLibellé écriture\tMode règlement\tDate échéance\tStatut règlement\tMontant réglé\tDate dernier règlement\tPosition règlement\tMontant à régler\tQuantité à régler\tDébit\tCrédit',
      'VTE001\t01/01/2025\tP000001\tFAC0001\tREF-001\t411000\tC00001\tFacture client exemple\tVirement\t01/02/2025\tnon_regle\t0\t\tEn attente\t1500.00\t1\t1500.00\t0',
      'VTE002\t02/01/2025\tP000002\tFAC0002\tREF-002\t411000\tINT001\tFacture service interne\tChèque\t17/01/2025\tpartiel\t1000.00\t15/01/2025\tPartiel\t500.00\t1\t1500.00\t0',
      'VTE003\t03/01/2025\tP000003\tFAC0003\tREF-003\t411000\tPART001\tFacture partenaire\tVirement\t03/03/2025\tregle\t2500.00\t01/02/2025\tSoldé\t0\t1\t2500.00\t0',
      'VTE004\t04/01/2025\tP000004\tAV0001\tAVOIR-001\t411000\tC00001\tAvoir sur facture\tVirement\t04/02/2025\tnon_regle\t0\t\tEn attente\t-500.00\t1\t0\t500.00'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-factures.txt';
    a.click();
  };

  const getPreviewData = () => {
    if (!importData) return { totalLines: 0, invoicesToImport: 0, preview: '' };
    
    const lines = importData.split('\n').filter(line => line.trim() !== '');
    return {
      totalLines: lines.length,
      invoicesToImport: Math.max(0, lines.length - 1),
      preview: lines.slice(0, 5).join('\n') + (lines.length > 5 ? '\n... (données tronquées)' : '')
    };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Import de Factures</h1>
        <p className="text-green-100">
          Importez vos factures depuis votre logiciel comptable avec création automatique des clients
        </p>
      </div>

      {/* Status Messages */}
      {importStatus !== 'idle' && (
        <div className={`rounded-xl p-4 border ${
          importStatus === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : importStatus === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {importStatus === 'success' ? (
              <CheckCircle className="mr-3 flex-shrink-0" size={20} />
            ) : importStatus === 'error' ? (
              <AlertCircle className="mr-3 flex-shrink-0" size={20} />
            ) : (
              <div className="mr-3 flex-shrink-0 w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <p>{importMessage}</p>
          </div>
          
          {importStatus === 'processing' && (
            <div className="mt-3">
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress / importTotal) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-blue-700 mt-1 text-right">
                {importProgress} / {importTotal} factures
              </p>
            </div>
          )}
          
          {/* Afficher les erreurs détaillées si nécessaire */}
          {importStatus !== 'processing' && importResults?.errorMessages?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <p className="font-medium mb-2">Détails des erreurs:</p>
              <ul className="text-sm space-y-1 ml-5 list-disc max-h-40 overflow-y-auto">
                {importResults.errorMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start">
          <Info className="text-blue-600 mr-3 mt-1 flex-shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Format d'import</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Format requis:</strong> Fichier texte avec séparateur tabulation</li>
              <li>• <strong>Colonnes obligatoires:</strong> N° compte tiers, Débit/Crédit, Date, N° facture</li>
              <li>• <strong>Règles appliquées:</strong></li>
              <li className="ml-4">- Si Mode règlement vide ou "Aucun": application du mode par défaut selon type client</li>
              <li className="ml-4">- Si Date échéance vide ou égale à date facture: application du délai par défaut</li>
              <li className="ml-4">- Détection automatique du type client (interne/partenaire/externe) selon le compte tiers</li>
              <li className="ml-4">- Si client existant: utilisation du type et des paramètres du client</li>
              <li className="ml-4">- Si montant au Crédit: traité comme "Facture Avoir" avec montant total négatif</li>
              <li className="ml-4">- Suppression automatique des doublons de facture</li>
              <li className="ml-4">- En cas d'erreur sur une facture, l'import continue avec les factures suivantes</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Télécharger un fichier</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Download size={16} className="mr-2" />
              Template
            </button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto mb-4 text-gray-400" size={48} />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Glissez-déposez votre export comptable
            </h4>
            <p className="text-gray-500 mb-4">ou</p>
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
              <FileText size={20} className="mr-2" />
              Choisir un fichier
              <input
                type="file"
                accept=".txt"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-400 mt-2">
              Export comptable au format .txt (tabulations)
            </p>
          </div>

          {/* Manual Input */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ou collez directement les données :
            </label>
            <textarea
              value={importData}
              onChange={(e) => {
                setImportData(e.target.value);
                parseImportData(e.target.value);
              }}
              placeholder="Collez ici le contenu de votre export comptable..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {importData && (
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {showPreview ? 'Masquer' : 'Prévisualiser'}
              </button>
              <button
                onClick={handleImport}
                disabled={parsedData.length === 0 || importStatus === 'processing'}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {importStatus === 'processing' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importation...
                  </>
                ) : (
                  'Importer'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Preview */}
        {showPreview && importData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Aperçu des données</h3>
            
            {validationErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2 flex items-center">
                  <AlertCircle size={16} className="mr-2" />
                  Erreurs de validation ({validationErrors.length})
                </h4>
                <ul className="text-sm text-red-700 space-y-1 ml-6 list-disc">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {getPreviewData().preview}
                </pre>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p><strong>Lignes détectées :</strong> {getPreviewData().totalLines}</p>
              <p><strong>Factures à importer :</strong> {parsedData.length}</p>
              
              {parsedData.length > 0 && (
                <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                  <p className="text-green-800 text-xs">
                    <strong>Prêt à importer :</strong> {parsedData.length} factures valides seront importées.
                    Les clients seront créés automatiquement si nécessaire.
                  </p>
                </div>
              )}
              
              {parsedData.length === 0 && importData && (
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                  <p className="text-red-800 text-xs">
                    <strong>Aucune facture valide :</strong> Veuillez corriger les erreurs ci-dessus avant d'importer.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Format Example */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exemple de format</h3>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre>
{`Code journal\tDate\tN° pièce\tN° facture\tRéférence\tN° compte général\tN° compte tiers\tLibellé écriture\tMode règlement\tDate échéance\tStatut règlement\tMontant réglé\tDate dernier règlement\tPosition règlement\tMontant à régler\tQuantité à régler\tDébit\tCrédit
VTE001\t01/01/2025\tP000001\tFAC0001\tREF-001\t411000\tC00001\tFacture client ABC\tVirement\t01/02/2025\tnon_regle\t0\t\tEn attente\t1500.00\t1\t1500.00\t0
VTE002\t02/01/2025\tP000002\tFAC0002\tREF-002\t411000\tINT001\tService formation interne\t\t\tpartiel\t1000.00\t15/01/2025\tPartiel\t500.00\t1\t1500.00\t0
VTE003\t03/01/2025\tP000003\tFAC0003\tREF-003\t411000\tPART001\tCollaboration partenaire\tAucun\t\tregle\t2500.00\t01/02/2025\tSoldé\t0\t1\t2500.00\t0
VTE004\t04/01/2025\tP000004\tAV0001\tAVOIR-001\t411000\tC00001\tAvoir sur facture\tVirement\t04/02/2025\tnon_regle\t0\t\tEn attente\t500.00\t1\t0\t500.00`}
          </pre>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Améliorations :</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Détection automatique du type de client (externe, interne, partenaire)</li>
            <li>Utilisation des informations du client existant si disponible</li>
            <li>Délai de paiement par défaut si date échéance vide: Externe = +30j, Interne = +15j, Partenaire = +60j</li>
            <li>Calcul automatique du solde restant = Montant total - Montant réglé</li>
            <li>Détermination du statut: Réglé si solde = 0, Partiel si montant réglé &gt; 0, Non réglé sinon</li>
            <li>Traitement des avoirs (montant au crédit) avec montant total négatif</li>
            <li>Suppression automatique des doublons de facture</li>
            <li>Poursuite de l'import même en cas d'erreur sur certaines factures</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImportTab;