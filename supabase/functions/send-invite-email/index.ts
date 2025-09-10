/* eslint-disable */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { to, token, link, subject, html } = await req.json();
    if (!to || !token || !link) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, token, link' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_4Xck74cC_6qgFRnRmCNQFnByitkfijzfx';
    const FROM_EMAIL = Deno.env.get('INVITES_FROM_EMAIL') || 'no-reply@baketracker.space';

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Email provider not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailSubject = subject || 'Your Vaketracker invitation';
    const emailHtml = html || `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.5;">
        <h2>You're invited to Vaketracker</h2>
        <p>Use the token below to complete your registration:</p>
        <p style="font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">${token}</p>
        <p>Open the link to register:</p>
        <p><a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a></p>
        <p>If you did not expect this email, you can ignore it.</p>
      </div>
    `;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(txt, { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


