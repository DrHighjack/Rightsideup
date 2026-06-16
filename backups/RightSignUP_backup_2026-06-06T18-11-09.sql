-- RightSignUP Database Backup
-- Generated: 2026-06-06T18:11:09.906Z
-- Database: railway
-- Tables: 28

-- SCHEMA DEFINITION

-- Table: _prisma_migrations
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id character varying NOT NULL,
  checksum character varying NOT NULL,
  finished_at timestamp with time zone,
  migration_name character varying NOT NULL,
  logs text,
  rolled_back_at timestamp with time zone,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  applied_steps_count integer DEFAULT 0 NOT NULL
);

-- Table: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id text NOT NULL,
  userId text NOT NULL,
  action USER-DEFINED NOT NULL,
  entityType text NOT NULL,
  entityId text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  id text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  isEncrypted boolean DEFAULT false NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: brokerages
CREATE TABLE IF NOT EXISTS brokerages (
  id text NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  adminId text NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: coupons
CREATE TABLE IF NOT EXISTS coupons (
  id text NOT NULL,
  code text NOT NULL,
  type text DEFAULT 'FIXED'::text NOT NULL,
  value double precision NOT NULL,
  maxUses integer,
  usedCount integer DEFAULT 0 NOT NULL,
  expiresAt timestamp without time zone,
  isActive boolean DEFAULT true NOT NULL,
  description text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: instaads
CREATE TABLE IF NOT EXISTS instaads (
  id text NOT NULL,
  fullName text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  brokerage text NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  assignedToUserId text,
  convertedAt timestamp without time zone,
  convertedToClientId text,
  followUpDate timestamp without time zone,
  lastContactedAt timestamp without time zone,
  notes text,
  status USER-DEFINED DEFAULT 'NEW'::"LeadStatus" NOT NULL
);

-- Table: inventory_item_printers
CREATE TABLE IF NOT EXISTS inventory_item_printers (
  id text NOT NULL,
  inventoryItemId text NOT NULL,
  printerId text NOT NULL
);

-- Table: inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  imageUrl text,
  totalQuantity integer DEFAULT 0 NOT NULL,
  availableQuantity integer DEFAULT 0 NOT NULL,
  lowStockThreshold integer DEFAULT 5 NOT NULL,
  isActive boolean DEFAULT true NOT NULL,
  isOrderable boolean DEFAULT true NOT NULL,
  pricePerUnit integer,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: invoices
CREATE TABLE IF NOT EXISTS invoices (
  id text NOT NULL,
  userId text NOT NULL,
  amount double precision,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  dueDate timestamp without time zone,
  lastReminderSentAt timestamp without time zone,
  reminderCount integer DEFAULT 0 NOT NULL,
  discountAmount double precision DEFAULT 0,
  invoiceNumber text,
  orderId text,
  paidAmount double precision,
  paidAt timestamp without time zone,
  qboInvoiceId text,
  status USER-DEFINED DEFAULT 'DRAFT'::"InvoiceStatus" NOT NULL
);

-- Table: job_assignments
CREATE TABLE IF NOT EXISTS job_assignments (
  id text NOT NULL,
  orderId text NOT NULL,
  fieldTechId text NOT NULL,
  assignedByUserId text NOT NULL,
  scheduledFor timestamp without time zone,
  startedAt timestamp without time zone,
  completedAt timestamp without time zone,
  techNotes text,
  issue text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  images jsonb
);

-- Table: low_inventory_alerts
CREATE TABLE IF NOT EXISTS low_inventory_alerts (
  id text NOT NULL,
  signType text NOT NULL,
  sentAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  threshold integer DEFAULT 5 NOT NULL
);

-- Table: master_prices
CREATE TABLE IF NOT EXISTS master_prices (
  id text NOT NULL,
  serviceType text NOT NULL,
  amountCents integer NOT NULL,
  description text,
  isActive boolean DEFAULT true NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id text NOT NULL,
  userId text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  status USER-DEFINED DEFAULT 'UNREAD'::"NotificationStatus" NOT NULL,
  link text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: order_addons
CREATE TABLE IF NOT EXISTS order_addons (
  id text NOT NULL,
  orderId text NOT NULL,
  inventoryItemId text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  priceAtOrder integer NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: order_discounts
CREATE TABLE IF NOT EXISTS order_discounts (
  id text NOT NULL,
  orderId text NOT NULL,
  couponId text NOT NULL,
  discountAmount double precision NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id text NOT NULL,
  orderId text NOT NULL,
  signId text,
  quantity integer DEFAULT 1 NOT NULL,
  isHangingSelf boolean DEFAULT false NOT NULL,
  storagePlannedAfter boolean,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
  id text NOT NULL,
  orderNumber text NOT NULL,
  realtorId text NOT NULL,
  type text NOT NULL,
  address text NOT NULL,
  addressLat double precision,
  addressLng double precision,
  scheduledDate timestamp without time zone,
  notes text,
  adminNotes text,
  cancelledAt timestamp without time zone,
  cancelReason text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  placedByTCId text,
  heldAt timestamp without time zone,
  holdReason text,
  status USER-DEFINED DEFAULT 'PENDING'::"OrderStatus" NOT NULL,
  isStale boolean DEFAULT false NOT NULL,
  staleAt timestamp without time zone,
  self811Accepted boolean DEFAULT false NOT NULL
);

-- Table: price_overrides
CREATE TABLE IF NOT EXISTS price_overrides (
  id text NOT NULL,
  serviceType text NOT NULL,
  amountCents integer NOT NULL,
  isLocked boolean DEFAULT false NOT NULL,
  userId text,
  brokerageId text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: qbo_connections
CREATE TABLE IF NOT EXISTS qbo_connections (
  id text NOT NULL,
  realmId text NOT NULL,
  companyName text,
  accessToken text NOT NULL,
  refreshToken text NOT NULL,
  expiresAt timestamp without time zone NOT NULL,
  refreshExpiresAt timestamp without time zone,
  isConnected boolean DEFAULT true NOT NULL,
  connectedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  disconnectedAt timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: self_811_policies
CREATE TABLE IF NOT EXISTS self_811_policies (
  id text NOT NULL,
  content text NOT NULL,
  version text NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: sign_printers
CREATE TABLE IF NOT EXISTS sign_printers (
  id text NOT NULL,
  name text NOT NULL,
  website text,
  phone text,
  email text,
  notes text,
  isActive boolean DEFAULT true NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: sign_reports
CREATE TABLE IF NOT EXISTS sign_reports (
  id text NOT NULL,
  signId text NOT NULL,
  reportedByUserId text NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  resolvedAt timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: signs
CREATE TABLE IF NOT EXISTS signs (
  id text NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  assignedToOrderId text,
  assignedToUserId text,
  deployedAddress text,
  deployedLat double precision,
  deployedLng double precision,
  notes text,
  purchasedAt timestamp without time zone,
  signNumber text,
  type text DEFAULT 'Standard'::text NOT NULL,
  status USER-DEFINED DEFAULT 'AVAILABLE'::"SignStatus" NOT NULL
);

-- Table: sms_logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id text NOT NULL,
  toNumber text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'PENDING'::text NOT NULL,
  eventType text NOT NULL,
  orderId text,
  userId text,
  sentAt timestamp without time zone,
  failureReason text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL
);

-- Table: tc_agent_links
CREATE TABLE IF NOT EXISTS tc_agent_links (
  id text NOT NULL,
  tcUserId text NOT NULL,
  agentUserId text NOT NULL,
  grantedBy text NOT NULL,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: tc_invites
CREATE TABLE IF NOT EXISTS tc_invites (
  id text NOT NULL,
  email text NOT NULL,
  invitedByUserId text NOT NULL,
  token text NOT NULL,
  expiresAt timestamp without time zone NOT NULL,
  usedAt timestamp without time zone,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table: tickets_811
CREATE TABLE IF NOT EXISTS tickets_811 (
  id text NOT NULL,
  ticketNumber text,
  sourceEmail text NOT NULL,
  emailSubject text NOT NULL,
  emailBody text NOT NULL,
  parsedAddress text,
  workStartDate timestamp without time zone,
  status USER-DEFINED DEFAULT 'NEW'::"Ticket811Status" NOT NULL,
  matchedOrderIds ARRAY,
  clearedAt timestamp without time zone,
  clearedByUserId text,
  adminNotes text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  allLinesRespondedAt timestamp without time zone,
  clearanceDate timestamp without time zone,
  realtorId text,
  requestedDate timestamp without time zone,
  stage text DEFAULT 'REQUESTED'::text NOT NULL,
  ticketSubmittedAt timestamp without time zone,
  utilityLines jsonb,
  orderId text,
  pdfUrl text,
  postAddressLat double precision,
  postAddressLng double precision
);

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id text NOT NULL,
  email text NOT NULL,
  passwordHash text NOT NULL,
  firstName text NOT NULL,
  lastName text NOT NULL,
  phone text,
  brokerageName text,
  brokerageId text,
  paymentMethod text DEFAULT 'OFFICE'::text,
  createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt timestamp without time zone NOT NULL,
  role USER-DEFINED DEFAULT 'REALTOR'::"Role" NOT NULL,
  qboCustomerId text,
  adminNotes text,
  tags ARRAY DEFAULT ARRAY[]::text[],
  freeInstallDate timestamp without time zone,
  freeInstallGivenBy text,
  lastLoginAt timestamp without time zone
);

-- DATA

INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('fb424cf6-6f69-4adf-a54c-d29a0fab3887', '94d8f09f365086430f048490371dea4164b6958609b9bd7b1ae2e5b4f24b66c2', '2026-06-02T19:50:48.400Z', '20260522222232_init', NULL, NULL, '2026-06-02T19:50:48.275Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('624562f2-240a-4f23-b65d-a7fa31803858', '7aa9da95daf6f898e8d832797a6e1194b9f30ee6728196ae1f5507c1d951b928', '2026-06-02T19:50:50.455Z', '20260531020658_add_last_login_at', NULL, NULL, '2026-06-02T19:50:50.344Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('1ef509eb-b840-4b1e-9c49-d258a959572b', '191ce39430e162633806171476be27b96e30485149aa1b3a997de651645119dd', '2026-06-02T19:50:48.557Z', '20260522223208_add_qbo_connection', NULL, NULL, '2026-06-02T19:50:48.444Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('863c9156-a908-46c3-922c-b96e43a064f7', '14ae8c8dee77912c172a518bd602c4c5d2523e925ba28b217689c53e23693a7b', '2026-06-02T19:50:48.717Z', '20260524142654_add_coupons_sms_logs', NULL, NULL, '2026-06-02T19:50:48.601Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('2cdac687-eebe-4dae-9535-efa229e577f9', '712aada08ee0cd2d26d324fa9ad9aa6c934bffa70d9c166f4e50650728d559d4', '2026-06-02T19:50:48.881Z', '20260524151639_add_phase3_tc_and_sign_inventory', NULL, NULL, '2026-06-02T19:50:48.761Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('2381ad4a-21fa-42ea-b65b-a371c5649232', '389603d97199bf8287d7f646c7497ac933c94492599c43d280402af81b72ad58', '2026-06-02T19:50:50.614Z', '20260531033914_add_pricing_models', NULL, NULL, '2026-06-02T19:50:50.499Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('82208aa8-def9-4d2f-b40e-2c31d54e9ab0', 'a89e830c264367e4909ab3446fd43aa2c338735b699cd0bff02ce7255394c140', '2026-06-02T19:50:49.041Z', '20260524151842_add_role_and_signstatus_enums', NULL, NULL, '2026-06-02T19:50:48.925Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('839918ef-4663-4a9c-aeb6-fc565e9be679', '141d44b683b54dfe8065afc3a5e96249d9605b5fdfc62e08d8ddb2910aa8ef82', '2026-06-02T19:50:49.199Z', '20260524162005_add_low_inventory_alerts', NULL, NULL, '2026-06-02T19:50:49.087Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('8126ce65-a071-439a-bbe6-38f64b307582', '7ea6a1a23a89eacfda15d659e123ae5e18a308d99ca016c9f72f551530aaf928', '2026-06-02T19:50:49.362Z', '20260524164113_add_phase4_schema', NULL, NULL, '2026-06-02T19:50:49.243Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('4aea295e-c713-4e67-947b-d4598d90bf56', '93862a8b4adfd807fd491aca462a9f862b96a929f16d2e626838ca7ef4c3e47a', '2026-06-02T19:50:50.770Z', '20260531205817_add_811_ticket_tracker_fields', NULL, NULL, '2026-06-02T19:50:50.658Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('aa30500e-dbfa-47d6-83a5-9d4bd7fa4604', '26c38fd3c69330ebcb890101ba6c8d92c6b482153fbb2e3174ad7d9a47c9b099', '2026-06-02T19:50:49.516Z', '20260524204306_add_invoice_aging_fields', NULL, NULL, '2026-06-02T19:50:49.406Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('71f473bb-6c18-4db7-8cbe-738f170f416d', '042910d4a37084eae7bd27cc9e83acd3a64a1eb9c88574a0fb946e37796dc5c0', '2026-06-02T19:50:49.671Z', '20260524204625_add_stale_order_flags', NULL, NULL, '2026-06-02T19:50:49.560Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('b8dda921-722d-494e-8653-7adee6b7dd5c', '73c6cacfe913f69cac7bc5def69a5b427643ca5dbbab1f5678f9939a84bd696b', '2026-06-02T19:50:49.834Z', '20260527170046_phase5_invoices_activity_notifications', NULL, NULL, '2026-06-02T19:50:49.715Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('6b585e62-f0c4-48e9-83d9-dc97c0a7f076', '222916a400d55c8dc84f2af181736626b036c7b2a46cfeb7be00a497e0c12fa8', '2026-06-02T19:50:50.924Z', '20260601051557_add_job_completion_images', NULL, NULL, '2026-06-02T19:50:50.814Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('f4a22a35-62b9-4abd-a3a2-0bac94010c34', '707122760229008ac84a7f6a2602945250118f66e5064d71f61ed567154ab3b3', '2026-06-02T19:50:49.990Z', '20260529011039_add_crm_polish_to_user', NULL, NULL, '2026-06-02T19:50:49.878Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('f62a96fc-9afb-4ee7-9d74-a928faf7cbd2', '261c1e996a1df5c7f55b4a285907ff404a2ed6e7de92619203a29769c5a3d638', '2026-06-02T19:50:50.145Z', '20260529054718_add_salesmen_role_and_free_install', NULL, NULL, '2026-06-02T19:50:50.034Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('d9273395-2670-4be2-87c0-3e8376902cb1', '778a848b2ec35f4f9c3893103cb661c6a3618bbcb90607cfe4b4923be2b66b6b', '2026-06-02T19:50:50.301Z', '20260529144333_add_in_ground_status', NULL, NULL, '2026-06-02T19:50:50.189Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('b40c74f8-d0fc-4110-a4fd-0fb3e3742ad0', '1471d39de43283ef692cb502b19678a51aa9b1e65db6bea660e1c8bf195fd0cb', '2026-06-02T19:50:51.091Z', '20260601165011_add_inventory_addons_and_policy', NULL, NULL, '2026-06-02T19:50:50.968Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('dd4dc299-7d86-41ad-96fe-81c06a45c565', '9b0cb81b11ada8ecc1adc91a910e09e2d4a8a5d5b52efce2b5d4a92036374a65', '2026-06-02T19:51:21.331Z', '20260602195121_add_instaads', NULL, NULL, '2026-06-02T19:51:21.215Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('a244de2e-e8b5-4255-a13c-5515816ab77f', '328b768e263571cb2d12130daa1953e088c1e85a29a8a86ee29082d8af800e11', '2026-06-03T19:23:35.067Z', '20260603192308_add_lead_status_and_management', NULL, NULL, '2026-06-03T19:23:34.952Z', 1);
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('784ae612-5780-4eb3-9da5-51d088d01d44', '2fdfea0349420819e5c25064cf8468d2def68183625058dafa735c4d2b0d818a', '2026-06-03T19:24:05.057Z', '20260603192404_', NULL, NULL, '2026-06-03T19:24:04.945Z', 1);
INSERT INTO activity_logs (id, userId, action, entityType, entityId, description, metadata, createdAt) VALUES ('cmpx468oh0003fqy1s3daijpt', 'cmpx3dbcg00002t5w7p93hhvx', 'JOB_ASSIGNED', 'JobAssignment', 'cmpx4682v0001fqy1otmc0l2s', 'Job assigned to Brennan Installer for order ORD-1780432190642-0asm9fmrr', '{"orderId":"cmpx3cuk30010zpmp0et9gumt","fieldTechId":"cmpx3genr0000mlmfufatgv0n","orderNumber":"ORD-1780432190642-0asm9fmrr","scheduledFor":"2026-06-04T00:00:00.000Z","fieldTechEmail":"brennan-installer@northshoresignco.com"}', '2026-06-03T03:52:41.970Z');
INSERT INTO activity_logs (id, userId, action, entityType, entityId, description, metadata, createdAt) VALUES ('cmpx46z1m0009fqy1r1at18be', 'cmpx3dbcg00002t5w7p93hhvx', 'JOB_ASSIGNED', 'JobAssignment', 'cmpx46ynt0007fqy1lsf4yy91', 'Job assigned to Brennan Installer for order ORD-1780432190479-rofjdj4vs', '{"orderId":"cmpx3cufj000wzpmpvte7qj2g","fieldTechId":"cmpx3genr0000mlmfufatgv0n","orderNumber":"ORD-1780432190479-rofjdj4vs","scheduledFor":"2026-06-01T20:53:00.000Z","fieldTechEmail":"brennan-installer@northshoresignco.com"}', '2026-06-03T03:53:16.139Z');
INSERT INTO activity_logs (id, userId, action, entityType, entityId, description, metadata, createdAt) VALUES ('cmpzm7pt70001h12d9158fvo7', 'cmpx3dbcg00002t5w7p93hhvx', 'ORDER_STATUS_CHANGED', 'Order', 'cmpx3cucy000szpmp51rff1ft', 'Order status changed from IN_GROUND to PENDING', '{"newStatus":"PENDING","oldStatus":"IN_GROUND","orderNumber":"ORD-1780432190385-t6xzsnfcv"}', '2026-06-04T21:53:16.268Z');
INSERT INTO activity_logs (id, userId, action, entityType, entityId, description, metadata, createdAt) VALUES ('cmpzmbr1p0005h12ditml1knu', 'cmpx3dbcg00002t5w7p93hhvx', 'ORDER_STATUS_CHANGED', 'Order', 'cmpx3cugt000yzpmp9hjp5oxg', 'Order status changed from ON_HOLD to SCHEDULED', '{"newStatus":"SCHEDULED","oldStatus":"ON_HOLD","orderNumber":"ORD-1780432190525-om02qegrr"}', '2026-06-04T21:56:24.493Z');
INSERT INTO activity_logs (id, userId, action, entityType, entityId, description, metadata, createdAt) VALUES ('cmpzmcidt000bh12dglzfy2w3', 'cmpx3dbcg00002t5w7p93hhvx', 'JOB_ASSIGNED', 'JobAssignment', 'cmpzmchtz0009h12d335sxqn1', 'Job assigned to Brennan Installer for order ORD-1780432190525-om02qegrr', '{"orderId":"cmpx3cugt000yzpmp9hjp5oxg","fieldTechId":"cmpx3genr0000mlmfufatgv0n","orderNumber":"ORD-1780432190525-om02qegrr","scheduledFor":"2026-06-04T19:00:00.000Z","fieldTechEmail":"brennan-installer@northshoresignco.com"}', '2026-06-04T21:56:59.921Z');
INSERT INTO brokerages (id, name, phone, email, adminId, createdAt, updatedAt) VALUES ('cmpx1yq5o0002fdlhx90xdwr9', 'Test Brokerage', '555-0100', 'info@testbrokerage.local', 'cmpx1yq330000fdlh4n7a65c2', '2026-06-03T02:50:52.141Z', '2026-06-03T02:50:52.141Z');
INSERT INTO coupons (id, code, type, value, maxUses, usedCount, expiresAt, isActive, description, createdAt, updatedAt) VALUES ('cmpx3eo9y0000lc9quoc0wm66', 'FREEINSTALL', 'FIXED', 150, NULL, 0, NULL, true, 'Free sign installation offer - Seattle area', '2026-06-03T03:31:15.815Z', '2026-06-03T03:31:15.815Z');
INSERT INTO instaads (id, fullName, phone, email, brokerage, createdAt, updatedAt, assignedToUserId, convertedAt, convertedToClientId, followUpDate, lastContactedAt, notes, status) VALUES ('cmpx36ej200001sc87g3bwe7e', 'Sarah Johnson', '(206) 555-1234', 'sarah@windermere.com', 'Windermere Real Estate', '2026-06-03T03:24:49.912Z', '2026-06-04T02:23:35.676Z', NULL, NULL, NULL, NULL, NULL, NULL, 'NEW');
INSERT INTO instaads (id, fullName, phone, email, brokerage, createdAt, updatedAt, assignedToUserId, convertedAt, convertedToClientId, followUpDate, lastContactedAt, notes, status) VALUES ('cmpx41ahs0000137ukigfv07c', 'Brennan Meir Ratican', '+1 805-390-1868', 'ratpackbr@gmail.com', 'TYest', '2026-06-03T03:48:50.972Z', '2026-06-04T02:23:35.676Z', NULL, NULL, NULL, NULL, NULL, NULL, 'NEW');
INSERT INTO instaads (id, fullName, phone, email, brokerage, createdAt, updatedAt, assignedToUserId, convertedAt, convertedToClientId, followUpDate, lastContactedAt, notes, status) VALUES ('cmpx48fkx000cfqy1r7z24ry0', 'Max treble', '2502583548', 'maxtreblebis@gmail.com', 'Remax', '2026-06-03T03:54:24.226Z', '2026-06-04T02:23:35.676Z', NULL, NULL, NULL, NULL, NULL, NULL, 'NEW');
INSERT INTO inventory_items (id, name, category, description, imageUrl, totalQuantity, availableQuantity, lowStockThreshold, isActive, isOrderable, pricePerUnit, createdAt, updatedAt) VALUES ('cmpx4c5rs0000wjx5uros3b24', 'White Flyer Box', 'FLYER_BOX', '', '', 10, 10, 5, true, true, 1830, '2026-06-03T03:57:18.136Z', '2026-06-03T03:57:18.136Z');
INSERT INTO inventory_items (id, name, category, description, imageUrl, totalQuantity, availableQuantity, lowStockThreshold, isActive, isOrderable, pricePerUnit, createdAt, updatedAt) VALUES ('cmpx4cotl0001wjx58v8nys56', 'White Signpost', 'SIGN', '', '', 40, 40, 5, true, true, NULL, '2026-06-03T03:57:42.825Z', '2026-06-03T03:57:42.825Z');
INSERT INTO job_assignments (id, orderId, fieldTechId, assignedByUserId, scheduledFor, startedAt, completedAt, techNotes, issue, createdAt, images) VALUES ('cmpx4682v0001fqy1otmc0l2s', 'cmpx3cuk30010zpmp0et9gumt', 'cmpx3genr0000mlmfufatgv0n', 'cmpx3dbcg00002t5w7p93hhvx', '2026-06-04T07:00:00.000Z', NULL, NULL, NULL, NULL, '2026-06-03T03:52:41.192Z', NULL);
INSERT INTO job_assignments (id, orderId, fieldTechId, assignedByUserId, scheduledFor, startedAt, completedAt, techNotes, issue, createdAt, images) VALUES ('cmpx46ynt0007fqy1lsf4yy91', 'cmpx3cufj000wzpmpvte7qj2g', 'cmpx3genr0000mlmfufatgv0n', 'cmpx3dbcg00002t5w7p93hhvx', '2026-06-02T03:53:00.000Z', NULL, NULL, NULL, NULL, '2026-06-03T03:53:15.641Z', NULL);
INSERT INTO job_assignments (id, orderId, fieldTechId, assignedByUserId, scheduledFor, startedAt, completedAt, techNotes, issue, createdAt, images) VALUES ('cmpzmchtz0009h12d335sxqn1', 'cmpx3cugt000yzpmp9hjp5oxg', 'cmpx3genr0000mlmfufatgv0n', 'cmpx3dbcg00002t5w7p93hhvx', '2026-06-05T02:00:00.000Z', NULL, NULL, NULL, NULL, '2026-06-04T21:56:59.207Z', NULL);
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpx3f3h40003zs45d8zo7wlj', 'cmpx3ctvx0006zpmpk4h9xcwx', 'Order ORD-1780432190479-rofjdj4vs updated', 'Your order status has changed from PENDING to SCHEDULED', 'ORDER_STATUS_CHANGED', 'UNREAD', '/dashboard/orders/cmpx3cufj000wzpmpvte7qj2g', '2026-06-03T03:31:35.512Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpx3g7a10007zs4509mz7j1j', 'cmpx3ctry0002zpmpz8tph71b', 'Order ORD-1780432190642-0asm9fmrr updated', 'Your order status has changed from PENDING to SCHEDULED', 'ORDER_STATUS_CHANGED', 'UNREAD', '/dashboard/orders/cmpx3cuk30010zpmp0et9gumt', '2026-06-03T03:32:27.098Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpx468sj0005fqy157zuc2bb', 'cmpx3genr0000mlmfufatgv0n', 'New job assigned: ORD-1780432190642-0asm9fmrr', 'You have been assigned a new job at 1120 Spring St, Seattle, WA 98122 scheduled for 6/4/2026', 'JOB_ASSIGNED', 'UNREAD', '/dashboard/jobs/cmpx4682v0001fqy1otmc0l2s', '2026-06-03T03:52:42.115Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpx46z3o000bfqy119ux59t6', 'cmpx3genr0000mlmfufatgv0n', 'New job assigned: ORD-1780432190479-rofjdj4vs', 'You have been assigned a new job at 2331 NE Park Dr, Issaquah, WA 98029 scheduled for 6/1/2026', 'JOB_ASSIGNED', 'UNREAD', '/dashboard/jobs/cmpx46ynt0007fqy1lsf4yy91', '2026-06-03T03:53:16.212Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpzm7px50003h12d7khx4vjl', 'cmpx3ctul0005zpmpghbl49ig', 'Order ORD-1780432190385-t6xzsnfcv updated', 'Your order status has changed from IN_GROUND to PENDING', 'ORDER_STATUS_CHANGED', 'UNREAD', '/dashboard/orders/cmpx3cucy000szpmp51rff1ft', '2026-06-04T21:53:16.409Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpzmbr5q0007h12dmv9of2xk', 'cmpx3ctvx0006zpmpk4h9xcwx', 'Order ORD-1780432190525-om02qegrr updated', 'Your order status has changed from ON_HOLD to SCHEDULED', 'ORDER_STATUS_CHANGED', 'UNREAD', '/dashboard/orders/cmpx3cugt000yzpmp9hjp5oxg', '2026-06-04T21:56:24.638Z');
INSERT INTO notifications (id, userId, title, message, type, status, link, createdAt) VALUES ('cmpzmcifw000dh12db6aqwsv7', 'cmpx3genr0000mlmfufatgv0n', 'New job assigned: ORD-1780432190525-om02qegrr', 'You have been assigned a new job at 18912 108th Ln SE, Renton, WA 98055 scheduled for 6/4/2026', 'JOB_ASSIGNED', 'UNREAD', '/dashboard/jobs/cmpzmchtz0009h12d335sxqn1', '2026-06-04T21:56:59.997Z');
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3ctxw0008zpmps9rns87o', 'ORD-1780432189843-utedlhq4o', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '7451 Ebbert Drive SE, Port Orchard, WA 98367', 47.4806952, -122.5727097, NULL, 'Free Install', NULL, NULL, NULL, '2026-03-10T14:00:00.000Z', '2026-06-03T03:29:49.845Z', NULL, NULL, NULL, 'COMPLETED', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3ctzv000azpmpe96dezsd', 'ORD-1780432189915-i3aj8d8nt', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '4814 N 25th St, Tacoma, WA 98406', 47.2700753, -122.5016525, NULL, NULL, NULL, NULL, NULL, '2026-04-08T14:00:00.000Z', '2026-06-03T03:29:49.916Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu17000czpmpockvwqwf', 'ORD-1780432189963-qs3g84te9', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '3594 Salmonberry Dr SE, Port Orchard, WA 98366', 47.5157328, -122.5959115, NULL, '1 of 2 for order', NULL, NULL, NULL, '2026-04-24T14:00:00.000Z', '2026-06-03T03:29:49.964Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu35000ezpmpemjwpqpi', 'ORD-1780432190032-j8vmcbgv1', 'cmpx3ctsm0003zpmpb8622qh8', 'INSTALL', '7041 67TH ST NW', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-29T14:00:00.000Z', '2026-06-03T03:29:50.033Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu4f000gzpmp7ppo4lvo', 'ORD-1780432190078-xjt1uroks', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '3940 CREEK VIEW CT SE, Port Orchard WA', 47.5122223, -122.5988991, NULL, '2 of 2 for order', NULL, NULL, NULL, '2026-04-24T14:00:00.000Z', '2026-06-03T03:29:50.079Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu5u000izpmpw2qyb4tn', 'ORD-1780432190129-1vzo9ncdh', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '7041 67TH ST NW, GigHarbor WA', 47.3188845, -122.6325148, NULL, NULL, NULL, NULL, NULL, '2026-04-29T14:00:00.000Z', '2026-06-03T03:29:50.130Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu75000kzpmpy20afe04', 'ORD-1780432190176-ky1yprw1w', 'cmpx3ctpy0000zpmpdewu46wl', 'INSTALL', '6717 56th St E, Puyallup, WA 98371', 47.2062513, -122.3408425, NULL, 'Pushing til July', NULL, NULL, NULL, '2026-06-03T03:29:50.176Z', '2026-06-03T03:29:50.177Z', NULL, NULL, NULL, 'ON_HOLD', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cu92000mzpmptohwxqch', 'ORD-1780432190245-exrk22eqp', 'cmpx3ctry0002zpmpz8tph71b', 'INSTALL', '25919 259th St E, Graham, WA 98338', 47.0207293, -122.2490459, NULL, 'Forey did mark', NULL, NULL, NULL, '2026-05-11T14:00:00.000Z', '2026-06-03T03:29:50.246Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cuac000ozpmpfeh5exw0', 'ORD-1780432190292-2k27ycq3r', 'cmpx3ctra0001zpmp8brd22py', 'INSTALL', '16310 Fremont Pl N, Shoreline, WA 98133', 47.7472591, -122.3518756, NULL, 'Free Install', NULL, NULL, NULL, '2026-05-14T14:00:00.000Z', '2026-06-03T03:29:50.293Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cubo000qzpmpbuxmjihu', 'ORD-1780432190339-v44cub23p', 'cmpx3cttx0004zpmp62pkj91e', 'INSTALL', '20212 83rd Pl NE, Kenmore, WA 98028', 47.7743768, -122.2281369, NULL, NULL, NULL, NULL, NULL, '2026-05-16T14:00:00.000Z', '2026-06-03T03:29:50.340Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cue8000uzpmp7llgi8g8', 'ORD-1780432190432-cnsm3s9mh', 'cmpx3ctvx0006zpmpk4h9xcwx', 'INSTALL', '3919 154th Pl SE, Mill Creek, WA 98012', 47.8580398, -122.1791757, NULL, NULL, NULL, NULL, NULL, '2026-05-27T14:00:00.000Z', '2026-06-03T03:29:50.433Z', NULL, NULL, NULL, 'IN_GROUND', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cufj000wzpmpvte7qj2g', 'ORD-1780432190479-rofjdj4vs', 'cmpx3ctvx0006zpmpk4h9xcwx', 'INSTALL', '2331 NE Park Dr, Issaquah, WA 98029', 47.5475271, -122.0000942, NULL, NULL, NULL, NULL, NULL, '2026-06-01T14:00:00.000Z', '2026-06-03T03:31:34.813Z', NULL, NULL, NULL, 'SCHEDULED', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cuk30010zpmp0et9gumt', 'ORD-1780432190642-0asm9fmrr', 'cmpx3ctry0002zpmpz8tph71b', 'INSTALL', '1120 Spring St, Seattle, WA 98122', 47.6105506, -122.3249019, NULL, 'Forey did mark', NULL, NULL, NULL, '2026-06-02T14:00:00.000Z', '2026-06-03T03:32:26.614Z', NULL, NULL, NULL, 'SCHEDULED', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cucy000szpmp51rff1ft', 'ORD-1780432190385-t6xzsnfcv', 'cmpx3ctul0005zpmpghbl49ig', 'INSTALL', '13221 3RD AVENUE CT NW', 47.3787605, -122.5427486, NULL, '', 'Had to move, 811 clearance done. Texted Mel for fast clearance on high power line', NULL, NULL, '2026-05-26T14:00:00.000Z', '2026-06-04T21:53:15.573Z', NULL, NULL, NULL, 'PENDING', false, NULL, false);
INSERT INTO orders (id, orderNumber, realtorId, type, address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt, placedByTCId, heldAt, holdReason, status, isStale, staleAt, self811Accepted) VALUES ('cmpx3cugt000yzpmp9hjp5oxg', 'ORD-1780432190525-om02qegrr', 'cmpx3ctvx0006zpmpk4h9xcwx', 'INSTALL', '18912 108th Ln SE, Renton, WA 98055', 47.4327865, -122.1948882, NULL, NULL, NULL, NULL, NULL, '2026-06-01T14:00:00.000Z', '2026-06-04T21:56:23.778Z', NULL, NULL, NULL, 'SCHEDULED', false, NULL, false);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx1yq330000fdlh4n7a65c2', 'admin@signpost.local', '$2a$12$hYDbS3Ey4UQF5DTPapBESuB.B4z7YwmQ1cmDawN0nE66rtO2RgRXC', 'Admin', 'User', NULL, NULL, NULL, 'OFFICE', '2026-06-03T02:50:52.047Z', '2026-06-03T02:50:52.047Z', 'ADMIN', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx1yqd80004fdlhqrf8n04h', 'test@realtor.local', '$2a$12$p5dzsDB9Qd87vYRWiHBHWeB/DLNFGA3XKDH1iegfqd.p3hIyIjyUe', 'Test', 'Realtor', '555-1234', 'Test Brokerage', 'cmpx1yq5o0002fdlhx90xdwr9', 'OFFICE', '2026-06-03T02:50:52.412Z', '2026-06-03T02:50:52.412Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctpy0000zpmpdewu46wl', 'paige@thepaigemiller.com', '', 'Paige', 'Miller', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.558Z', '2026-06-03T03:29:49.558Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctra0001zpmp8brd22py', 'matt.reynolds@northshoresignco.com', '', 'Matt', 'Reynolds', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.606Z', '2026-06-03T03:29:49.606Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctry0002zpmpz8tph71b', 'forey.duckett@northshoresignco.com', '', 'Forey', 'Duckett', '2067304779', NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.630Z', '2026-06-03T03:29:49.630Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctsm0003zpmpb8622qh8', 'pavan.ankanpally@northshoresignco.com', '', 'Pavan', 'Ankanpally', '4087688685', NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.654Z', '2026-06-03T03:29:49.654Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3cttx0004zpmp62pkj91e', 'satishrealtor9@gmail.com', '', 'Satish', 'Chigullapally', '5104565621', NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.701Z', '2026-06-03T03:29:49.701Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctul0005zpmpghbl49ig', 'stacey.tull@northshoresignco.com', '', 'Stacey', 'Tull', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.726Z', '2026-06-03T03:29:49.726Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3ctvx0006zpmpk4h9xcwx', 'n_pranathi1@yahoo.com', '', 'Pranathi', 'Nandivada', '425-773-2181', NULL, NULL, 'OFFICE', '2026-06-03T03:29:49.773Z', '2026-06-03T03:29:49.773Z', 'REALTOR', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3dbfu00012t5w7zcawa3z', 'maxtreblebusiness@gmail.com', '$2a$10$QV06FbHXSriA6L6GRZsA6.vDSSpFirp16VNZBthFBFyPeGn4JRmxC', 'Max', 'Treble', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:30:12.522Z', '2026-06-03T03:30:12.522Z', 'ADMIN', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3dbii00022t5w4wy1tgmj', 'postproidaho@gmail.com', '$2a$10$KYXne9Dq9wfgVzgm/ap6mOSF6.hPmqCC.YIo0MDm4EnQpXEfHUwz6', 'Tyson', 'Sims', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:30:12.618Z', '2026-06-03T03:30:12.618Z', 'ADMIN', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3dbl600032t5wteey5wf7', '02awofford@gmail.com', '$2a$10$/xOGe6DqSoVKCpb6bEdGkuxCgRO8Evvabg7FW7SAz1e1IzZsdAKFS', 'Lexee', 'Offord', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:30:12.714Z', '2026-06-03T03:30:12.714Z', 'ADMIN', NULL, NULL, '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3genr0000mlmfufatgv0n', 'brennan-installer@northshoresignco.com', '$2a$10$Wj44lioL0T1uecVAXwR88.8mintEs3V4dvOyk6QZmIGyt.BEmjWO.', 'Brennan', 'Installer', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:32:36.663Z', '2026-06-03T03:32:36.663Z', 'FIELD_TECH', NULL, '[{"text":"Linked to Brennan admin account (brennan@northshoresignco.com)","createdAt":"2026-06-02T20:32:36.661Z","adminId":"cmpx3dbcg00002t5w7p93hhvx"}]', '[]', NULL, NULL, NULL);
INSERT INTO users (id, email, passwordHash, firstName, lastName, phone, brokerageName, brokerageId, paymentMethod, createdAt, updatedAt, role, qboCustomerId, adminNotes, tags, freeInstallDate, freeInstallGivenBy, lastLoginAt) VALUES ('cmpx3dbcg00002t5w7p93hhvx', 'brennan@northshoresignco.com', '$2a$10$/YRWT0Gg/2bvGfUnvEbOtuTXEodIt.ASWFBcoc9B5W3RbWSPBZNBe', 'Brennan', 'Me', NULL, NULL, NULL, 'OFFICE', '2026-06-03T03:30:12.400Z', '2026-06-07T00:46:20.260Z', 'ADMIN', NULL, NULL, '[]', NULL, NULL, '2026-06-07T00:46:20.259Z');
