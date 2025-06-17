import { supabase } from './supabase';

/**
 * Sends a magic link email to a user
 * 
 * @param email The email address of the user
 * @returns Promise that resolves when the email is sent
 */
export async function sendMagicLinkEmail(email: string): Promise<boolean> {
  try {
    // First check if the email exists
    const { data: checkData, error: checkError } = await supabase.rpc('check_email_and_send_link', {
      user_email: email
    });

    if (checkError || !checkData.success) {
      console.error('Error checking email:', checkError || checkData.error);
      return false;
    }

    // Send the magic link using Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('Error sending magic link:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending magic link email:', error);
    return false;
  }
}

/**
 * Sends a setup email to a newly created user
 * 
 * @param recipientEmail The email address of the recipient
 * @param setupUrl The setup URL for the user to set their password
 * @param userName Optional user name for personalization
 * @returns Promise that resolves when the email is sent
 */
export async function sendSetupEmail(
  recipientEmail: string,
  setupUrl: string,
  userName?: string
): Promise<void> {
  try {
    console.log('Attempting to send setup email to:', recipientEmail);
    
    // Call the Edge Function to handle email sending
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'send-setup-email',
      {
        body: {
          recipient: recipientEmail,
          setup_url: setupUrl,
          user_name: userName || ''
        }
      }
    );

    if (functionError) {
      console.error('Error calling send-setup-email function:', functionError);
      throw new Error(`Failed to call email function: ${functionError.message}`);
    }

    if (!functionData?.success) {
      console.warn('Email function returned non-success response:', functionData);
      // Don't throw an error here since the setup URL is still available for manual sharing
    }

    console.log('Email function response:', functionData);
    return;
  } catch (error) {
    console.error('Error sending setup email:', error);
    // Don't re-throw the error to prevent blocking user creation
    // The setup URL will still be displayed for manual sharing
    console.warn('Email sending failed, but user creation will continue with manual setup URL sharing');
  }
}

/**
 * Resends a setup email to an existing user
 * 
 * @param email The email address of the user
 * @returns Promise that resolves with the result of the operation
 */
export async function resendSetupEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    // Call the RPC function to generate a new setup link
    const { data, error } = await supabase.rpc('resend_password_setup_link', {
      user_email: email
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate setup link');
    }

    // Attempt to send the email with the new setup link
    try {
      await sendSetupEmail(email, data.setup_url);
      return {
        success: true,
        message: 'Setup email has been queued for sending. Setup link is available for manual sharing if needed.'
      };
    } catch (emailError) {
      return {
        success: true,
        message: 'Setup link generated successfully. Please share the link manually as email service is not configured.'
      };
    }
  } catch (error) {
    console.error('Error resending setup email:', error);
    return {
      success: false,
      message: error.message || 'Failed to resend setup email'
    };
  }
}