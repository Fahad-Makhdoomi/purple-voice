-- Call recording: on for Pro and Enterprise, off for Free and Basic (super admins can change it in Plans & pricing).
UPDATE "Plan" SET "features" = "features" || jsonb_build_object('callRecording', "code" IN ('PRO', 'ENTERPRISE'))
WHERE NOT ("features"::jsonb ? 'callRecording');

UPDATE "Plan" SET "highlights" = array_append("highlights", 'Every call recorded')
WHERE "code" = 'PRO' AND NOT ('Every call recorded' = ANY("highlights"));
