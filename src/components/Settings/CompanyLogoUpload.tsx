import React, { useState, useRef } from 'react';
import { Upload, Image, X, Check, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../types';

interface CompanyLogoUploadProps {
  company: Company;
  onLogoUpdated: (logoUrl: string, fileName: string) => void;
}

const CompanyLogoUpload: React.FC<CompanyLogoUploadProps> = ({ company, onLogoUpdated }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Validation du type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return 'Format de fichier non supporté. Utilisez JPG, PNG, GIF, WebP ou SVG.';
    }

    // Validation de la taille
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return 'Le fichier est trop volumineux. Taille maximum : 5MB.';
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    await uploadLogo(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      const validationError = validateFile(file);
      if (validationError) {
        setUploadError(validationError);
        return;
      }

      await uploadLogo(file);
    }
  };

  const uploadLogo = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      console.log('🔄 Début de l\'upload du logo pour la société:', company.name);
      
      // Vérifier que l'utilisateur est connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Utilisateur non authentifié');
      }

      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${company.id}-${Date.now()}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      console.log('📁 Nom du fichier:', fileName);
      console.log('📂 Chemin:', filePath);

      // Vérifier si le bucket existe, sinon le créer
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Erreur lors de la vérification des buckets:', bucketsError);
      }

      const bucketExists = buckets?.some(bucket => bucket.name === 'company-assets');
      if (!bucketExists) {
        console.log('🪣 Création du bucket company-assets...');
        const { error: createBucketError } = await supabase.storage.createBucket('company-assets', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
          fileSizeLimit: 5242880 // 5MB
        });

        if (createBucketError) {
          console.error('Erreur lors de la création du bucket:', createBucketError);
          // Continuer même si le bucket existe déjà
        }
      }

      // Supprimer l'ancien logo s'il existe
      if (company.logoFileName) {
        console.log('🗑️ Suppression de l\'ancien logo:', company.logoFileName);
        const { error: removeError } = await supabase.storage
          .from('company-assets')
          .remove([`company-logos/${company.logoFileName}`]);
        
        if (removeError) {
          console.warn('Avertissement lors de la suppression de l\'ancien logo:', removeError);
          // Ne pas faire échouer l'upload pour autant
        }
      }

      // Upload du nouveau fichier
      console.log('⬆️ Upload du fichier...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Permettre l'écrasement
        });

      if (uploadError) {
        console.error('Erreur lors de l\'upload:', uploadError);
        throw new Error(`Erreur d'upload: ${uploadError.message}`);
      }

      console.log('✅ Upload réussi:', uploadData);

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(filePath);

      console.log('🔗 URL publique:', publicUrl);

      // Mettre à jour la base de données
      console.log('💾 Mise à jour de la base de données...');
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          logo_url: publicUrl,
          logo_file_name: fileName
        })
        .eq('id', company.id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour de la base de données:', updateError);
        throw new Error(`Erreur de base de données: ${updateError.message}`);
      }

      console.log('✅ Logo mis à jour avec succès');
      setUploadSuccess(true);
      onLogoUpdated(publicUrl, fileName);

      // Réinitialiser le succès après 3 secondes
      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Erreur lors de l\'upload:', error);
      
      // Messages d'erreur plus spécifiques
      let errorMessage = 'Erreur lors de l\'upload du logo';
      
      if (error.message.includes('not authenticated')) {
        errorMessage = 'Vous devez être connecté pour uploader un logo.';
      } else if (error.message.includes('storage')) {
        errorMessage = 'Erreur de stockage. Veuillez réessayer.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Permissions insuffisantes pour uploader le fichier.';
      } else if (error.message.includes('size')) {
        errorMessage = 'Le fichier est trop volumineux.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      // Réinitialiser l'input file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!company.logoFileName) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer le logo de cette société ?')) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      console.log('🗑️ Suppression du logo:', company.logoFileName);

      // Supprimer le fichier du storage
      const { error: removeError } = await supabase.storage
        .from('company-assets')
        .remove([`company-logos/${company.logoFileName}`]);

      if (removeError) {
        console.warn('Avertissement lors de la suppression:', removeError);
        // Continuer même si la suppression échoue
      }

      // Mettre à jour la base de données
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          logo_url: null,
          logo_file_name: null
        })
        .eq('id', company.id);

      if (updateError) {
        throw updateError;
      }

      console.log('✅ Logo supprimé avec succès');
      onLogoUpdated('', '');
      setUploadSuccess(true);

      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression:', error);
      setUploadError(error.message || 'Erreur lors de la suppression du logo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Logo de la société</h4>
        {company.logoUrl && (
          <button
            onClick={handleRemoveLogo}
            disabled={isUploading}
            className="flex items-center text-red-600 hover:text-red-800 text-sm disabled:opacity-50 transition-colors"
          >
            <Trash2 size={14} className="mr-1" />
            Supprimer
          </button>
        )}
      </div>

      {/* Aperçu du logo actuel */}
      {company.logoUrl && (
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="relative">
            <img
              src={company.logoUrl}
              alt={`Logo ${company.name}`}
              className="w-16 h-16 object-contain rounded-lg bg-white border border-gray-200"
              onError={(e) => {
                console.error('Erreur de chargement de l\'image:', company.logoUrl);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Logo actuel</p>
            <p className="text-xs text-gray-500">{company.logoFileName}</p>
            <a 
              href={company.logoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Voir en taille réelle
            </a>
          </div>
        </div>
      )}

      {/* Zone d'upload */}
      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600">Upload en cours...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center">
              {dragActive ? (
                <Upload size={32} className="text-blue-500" />
              ) : (
                <Image size={32} className="text-gray-400" />
              )}
            </div>
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Choisir un fichier
              </button>
              <p className="text-sm text-gray-500 mt-1">
                ou glissez-déposez une image ici
              </p>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <p>Formats supportés : JPG, PNG, GIF, WebP, SVG</p>
              <p>Taille maximum : 5MB</p>
              <p>Recommandé : 200x200px ou plus, format carré</p>
            </div>
          </div>
        )}
      </div>

      {/* Messages d'état */}
      {uploadError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-700 text-sm font-medium">Erreur d'upload</p>
            <p className="text-red-600 text-sm">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-green-700 text-sm">
            Logo mis à jour avec succès ! Le changement sera visible dans quelques instants.
          </p>
        </div>
      )}

      {/* Informations sur le stockage */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle size={16} className="text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">À propos du stockage des logos</p>
            <ul className="space-y-1 text-xs">
              <li>• Les logos sont stockés de manière sécurisée dans Supabase Storage</li>
              <li>• Ils sont accessibles à tous les utilisateurs de l'application</li>
              <li>• Les anciens logos sont automatiquement supprimés lors du remplacement</li>
              <li>• Les logos apparaîtront dans la barre latérale et les en-têtes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyLogoUpload;