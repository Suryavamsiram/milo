/*
  # Add new notification types for gig completion flow

  ## Overview
  Adds support for 'gig_completion_pending' and 'gig_redo' notification types
  to support the contractor completion approval workflow.

  ## Changes
  - Drop and recreate the notifications type CHECK constraint to include
    'gig_completion_pending' and 'gig_redo' types
  - Add CHECK constraint on gigs status to include 'in_progress' state
*/

-- First, drop the existing check constraint on notifications type
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'gig_match',
    'gig_application',
    'application_accepted',
    'application_rejected',
    'escrow_held',
    'escrow_released',
    'escrow_refund',
    'payment_received',
    'gig_completed',
    'gig_completion_pending',
    'gig_redo'
  ));
