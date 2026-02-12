-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the Pre-Order Notification Job
-- Runs daily at 20:00 UTC (14:00 CDMX Standard Time)
-- Hits the WhatsApp Webhook with action=notify_preorders
select cron.unschedule('notify_preorders');

select cron.schedule(
    'notify_preorders',
    '0 20 * * *',
    $$
    select
        net.http_post(
            url:='https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook?action=notify_preorders&secret=yoko_master_key',
            headers:='{"Content-Type": "application/json"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);
