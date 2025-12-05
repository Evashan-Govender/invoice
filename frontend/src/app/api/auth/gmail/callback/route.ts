import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?gmail_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?gmail_error=No authorization code received', request.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Token exchange error:', tokens);
      return NextResponse.redirect(
        new URL(`/settings?gmail_error=${encodeURIComponent(tokens.error_description || tokens.error)}`, request.url)
      );
    }

    // Get user email from Gmail API profile
    let email = '';
    try {
      const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const profile = await profileResponse.json();
      email = profile.emailAddress || '';
    } catch (e) {
      console.error('Error getting Gmail profile:', e);
    }

    // Fallback: try userinfo endpoint
    if (!email) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        const userInfo = await userInfoResponse.json();
        email = userInfo.email || '';
      } catch (e) {
        console.error('Error getting user info:', e);
      }
    }

    // Calculate token expiry
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + (tokens.expires_in || 3600));

    // Encode tokens to pass via URL (temporary - will be saved on settings page)
    const gmailData = encodeURIComponent(JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      token_expiry: expiryDate.toISOString(),
      email: email || 'connected@gmail.com',
    }));

    return NextResponse.redirect(
      new URL(`/settings?gmail_success=true&gmail_data=${gmailData}`, request.url)
    );
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/settings?gmail_error=${encodeURIComponent('Failed to complete Gmail authorization')}`, request.url)
    );
  }
}
