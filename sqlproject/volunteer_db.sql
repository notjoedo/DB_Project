-- =====================================================================
--  Volunteer Management Mini-World  —  MySQL 8.0 script
--  Creates the schema, all tables, PK/FK constraints, and sample data.
--  Run the whole file in MySQL Workbench (lightning-bolt icon) or:
--      mysql -u root -p < volunteer_db.sql
-- =====================================================================

DROP DATABASE IF EXISTS volunteer_db;
CREATE DATABASE volunteer_db;
USE volunteer_db;

-- ---------------------------------------------------------------------
-- 1. Organization
-- ---------------------------------------------------------------------
CREATE TABLE Organization (
    OrgID         INT           NOT NULL AUTO_INCREMENT,
    Name          VARCHAR(100)  NOT NULL,
    Type          VARCHAR(30)   NOT NULL,
    ContactEmail  VARCHAR(100)  NOT NULL,
    CONSTRAINT PK_Organization PRIMARY KEY (OrgID),
    CONSTRAINT UQ_Organization_Name  UNIQUE (Name),
    CONSTRAINT UQ_Organization_Email UNIQUE (ContactEmail),
    CONSTRAINT CK_Organization_Type CHECK
        (Type IN ('Nonprofit','Government','School','Community Group','Business'))
);

-- ---------------------------------------------------------------------
-- 2. Users   ("User" is a reserved word in several DBMSs, so renamed)
-- ---------------------------------------------------------------------
CREATE TABLE Users (
    UserID  INT           NOT NULL AUTO_INCREMENT,
    FName   VARCHAR(50)   NOT NULL,
    LName   VARCHAR(50)   NOT NULL,
    Email   VARCHAR(100)  NOT NULL,
    CONSTRAINT PK_Users PRIMARY KEY (UserID),
    CONSTRAINT UQ_Users_Email UNIQUE (Email)
);

-- ---------------------------------------------------------------------
-- 3. Role  (lookup table — replaces the multivalued Role attribute)
-- ---------------------------------------------------------------------
CREATE TABLE Role (
    RoleID    TINYINT      NOT NULL,
    RoleName  VARCHAR(20)  NOT NULL,
    CONSTRAINT PK_Role PRIMARY KEY (RoleID),
    CONSTRAINT UQ_Role_Name UNIQUE (RoleName)
);

-- ---------------------------------------------------------------------
-- 4. UserRole  (one row per role a user holds -> satisfies 1NF)
-- ---------------------------------------------------------------------
CREATE TABLE UserRole (
    UserID  INT      NOT NULL,
    RoleID  TINYINT  NOT NULL,
    CONSTRAINT PK_UserRole PRIMARY KEY (UserID, RoleID),
    CONSTRAINT FK_UserRole_User FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_UserRole_Role FOREIGN KEY (RoleID)
        REFERENCES Role(RoleID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ---------------------------------------------------------------------
-- 5. VolunteerOpportunity  (Organization 1 --Creates-- M Opportunity)
-- ---------------------------------------------------------------------
CREATE TABLE VolunteerOpportunity (
    OpportunityID  INT           NOT NULL AUTO_INCREMENT,
    OrgID          INT           NOT NULL,
    Title          VARCHAR(150)  NOT NULL,
    EventDate      DATE          NOT NULL,
    Location       VARCHAR(150)  NOT NULL,
    CONSTRAINT PK_VolunteerOpportunity PRIMARY KEY (OpportunityID),
    CONSTRAINT FK_Opportunity_Org FOREIGN KEY (OrgID)
        REFERENCES Organization(OrgID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------------------------------------------
-- 6. OrganizationMember  (associative entity: Users M:N Organization)
-- ---------------------------------------------------------------------
CREATE TABLE OrganizationMember (
    MembershipID  INT          NOT NULL AUTO_INCREMENT,
    OrgID         INT          NOT NULL,
    UserID        INT          NOT NULL,
    JoinDate      DATE         NOT NULL,
    OrgRole       VARCHAR(30)  NOT NULL DEFAULT 'Member',
    CONSTRAINT PK_OrganizationMember PRIMARY KEY (MembershipID),
    CONSTRAINT UQ_Member_OrgUser UNIQUE (OrgID, UserID),
    CONSTRAINT FK_Member_Org FOREIGN KEY (OrgID)
        REFERENCES Organization(OrgID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_Member_User FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT CK_Member_OrgRole CHECK
        (OrgRole IN ('Member','Coordinator','Officer','Director'))
);

-- ---------------------------------------------------------------------
-- 7. Registration  (associative entity: Users M:N VolunteerOpportunity)
-- ---------------------------------------------------------------------
CREATE TABLE Registration (
    RegistrationID    INT           NOT NULL AUTO_INCREMENT,
    UserID            INT           NOT NULL,
    OpportunityID     INT           NOT NULL,
    RegistrationDate  DATE          NOT NULL,
    Status            VARCHAR(20)   NOT NULL DEFAULT 'Pending',
    HoursLogged       DECIMAL(4,1)  NOT NULL DEFAULT 0.0,
    CONSTRAINT PK_Registration PRIMARY KEY (RegistrationID),
    CONSTRAINT UQ_Registration_UserOpp UNIQUE (UserID, OpportunityID),
    CONSTRAINT FK_Registration_User FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_Registration_Opp FOREIGN KEY (OpportunityID)
        REFERENCES VolunteerOpportunity(OpportunityID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT CK_Registration_Status CHECK
        (Status IN ('Pending','Confirmed','Cancelled','Completed')),
    CONSTRAINT CK_Registration_Hours CHECK (HoursLogged BETWEEN 0 AND 24)
);

-- =====================================================================
--  SAMPLE DATA
-- =====================================================================

-- Organization (20)
INSERT INTO Organization (Name, Type, ContactEmail) VALUES
('Green Canopy Alliance',          'Nonprofit',       'info@greencanopy.org'),
('Riverside Tree Stewards',        'Community Group', 'stewards@riversidetrees.org'),
('City Parks & Recreation Dept',   'Government',      'parks@cityparks.gov'),
('Oakridge High Environmental Club','School',         'envclub@oakridgehs.edu'),
('Habitat Builders Coalition',     'Nonprofit',       'build@habitatcoalition.org'),
('Hillside Food Pantry',           'Nonprofit',       'help@hillsidepantry.org'),
('Maple Street Neighborhood Assoc','Community Group', 'board@maplestreet.org'),
('County Extension Office',        'Government',      'extension@county.gov'),
('Northview Elementary PTA',       'School',          'pta@northviewes.edu'),
('TrailWorks Volunteers',          'Nonprofit',       'crew@trailworks.org'),
('Clearwater Watershed Partners',  'Nonprofit',       'contact@clearwaterwp.org'),
('Evergreen Senior Center',        'Nonprofit',       'desk@evergreensc.org'),
('State University Service Corps', 'School',          'service@stateu.edu'),
('Pinecrest Garden Club',          'Community Group', 'hello@pinecrestgarden.org'),
('Urban Harvest Co-op',            'Business',        'farm@urbanharvest.coop'),
('Lakeside Animal Rescue',         'Nonprofit',       'adopt@lakesiderescue.org'),
('Downtown Business Alliance',     'Business',        'events@downtownba.com'),
('Friends of the County Library',  'Nonprofit',       'friends@countylibrary.org'),
('Westfield Youth Mentors',        'Nonprofit',       'mentor@westfieldyouth.org'),
('Arbor Day Planting Crew',        'Community Group', 'plant@arbordaycrew.org');

-- Users (30)
INSERT INTO Users (FName, LName, Email) VALUES
('Olivia',   'Bennett',   'olivia.bennett@mail.com'),
('Liam',     'Carter',    'liam.carter@mail.com'),
('Emma',     'Diaz',      'emma.diaz@mail.com'),
('Noah',     'Evans',     'noah.evans@mail.com'),
('Ava',      'Foster',    'ava.foster@mail.com'),
('Elijah',   'Garcia',    'elijah.garcia@mail.com'),
('Sophia',   'Hughes',    'sophia.hughes@mail.com'),
('James',    'Ito',       'james.ito@mail.com'),
('Isabella', 'Johnson',   'isabella.johnson@mail.com'),
('Lucas',    'Kim',       'lucas.kim@mail.com'),
('Mia',      'Lopez',     'mia.lopez@mail.com'),
('Mason',    'Martin',    'mason.martin@mail.com'),
('Amelia',   'Nguyen',    'amelia.nguyen@mail.com'),
('Ethan',    'Owens',     'ethan.owens@mail.com'),
('Harper',   'Patel',     'harper.patel@mail.com'),
('Logan',    'Quinn',     'logan.quinn@mail.com'),
('Evelyn',   'Rivera',    'evelyn.rivera@mail.com'),
('Aiden',    'Shah',      'aiden.shah@mail.com'),
('Abigail',  'Thompson',  'abigail.thompson@mail.com'),
('Jackson',  'Underwood', 'jackson.underwood@mail.com'),
('Emily',    'Vasquez',   'emily.vasquez@mail.com'),
('Sebastian','Walker',    'sebastian.walker@mail.com'),
('Ella',     'Xu',        'ella.xu@mail.com'),
('Henry',    'Young',     'henry.young@mail.com'),
('Grace',    'Zimmerman', 'grace.zimmerman@mail.com'),
('Daniel',   'Adams',     'daniel.adams@mail.com'),
('Chloe',    'Brooks',    'chloe.brooks@mail.com'),
('Samuel',   'Collins',   'samuel.collins@mail.com'),
('Lily',     'Douglas',   'lily.douglas@mail.com'),
('Owen',     'Ellis',     'owen.ellis@mail.com');

-- Role (4 — the domain from the ER diagram)
INSERT INTO Role (RoleID, RoleName) VALUES
(1, 'User'), (2, 'Organizer'), (3, 'Arborist'), (4, 'Admin');

-- UserRole: every user holds the base 'User' role ...
INSERT INTO UserRole (UserID, RoleID)
SELECT UserID, 1 FROM Users;
-- ... and some hold additional roles (43 rows total)
INSERT INTO UserRole (UserID, RoleID) VALUES
(1,2),(4,2),(7,2),(10,2),(13,2),(16,2),(19,2),(22,2),   -- Organizers
(3,3),(8,3),(15,3),(24,3),                              -- Arborists
(1,4);                                                  -- Admin

-- VolunteerOpportunity (25) — 1-15 already happened, 16-25 upcoming
INSERT INTO VolunteerOpportunity (OrgID, Title, EventDate, Location) VALUES
(1,  'Spring Street Tree Planting',   '2026-03-21', 'Elm Park, North Entrance'),
(2,  'Riverbank Cleanup Day',         '2026-04-11', 'Riverside Trail, Mile 2'),
(3,  'Community Park Mulching',       '2026-04-25', 'Central City Park'),
(4,  'Campus Native Garden Install',  '2026-05-02', 'Oakridge High School Courtyard'),
(5,  'Home Build Weekend',            '2026-05-16', '412 Cedar Lane'),
(6,  'Food Drive Sorting Shift',      '2026-06-06', 'Hillside Food Pantry Warehouse'),
(10, 'Trail Erosion Repair',          '2026-06-20', 'Ridgeback Trailhead'),
(11, 'Stream Water Sampling',         '2026-07-11', 'Clearwater Creek, Station 4'),
(1,  'Summer Tree Watering Crew',     '2026-07-25', 'Downtown Median Strips'),
(14, 'Community Garden Weeding',      '2026-08-08', 'Pinecrest Community Garden'),
(16, 'Adoption Event Helpers',        '2026-08-22', 'Lakeside Animal Shelter'),
(20, 'Tree Health Survey',            '2026-09-12', 'Maple Street Corridor'),
(13, 'Campus Service Day',            '2026-09-26', 'State University Main Quad'),
(12, 'Senior Tech Help Session',      '2026-10-03', 'Evergreen Senior Center'),
(7,  'Neighborhood Leaf Cleanup',     '2026-10-17', 'Maple Street, 300 Block'),
(1,  'Fall Tree Planting Festival',   '2026-11-07', 'Elm Park, Main Lawn'),
(6,  'Thanksgiving Meal Packing',     '2026-11-21', 'Hillside Food Pantry Warehouse'),
(18, 'Book Sale Setup',               '2026-12-05', 'County Main Library'),
(19, 'Holiday Mentoring Party',       '2026-12-12', 'Westfield Community Center'),
(3,  'Winter Pruning Workshop',       '2027-01-16', 'City Parks Maintenance Yard'),
(8,  'Seed Starting Clinic',          '2027-02-20', 'County Extension Greenhouse'),
(9,  'School Arbor Day Prep',         '2027-03-13', 'Northview Elementary'),
(15, 'Urban Farm Bed Building',       '2027-03-27', 'Urban Harvest Farm Lot'),
(2,  'Spring Riverbank Planting',     '2027-04-10', 'Riverside Trail, Mile 5'),
(17, 'Downtown Planter Refresh',      '2027-04-24', 'Main Street Plaza');

-- OrganizationMember (30)
INSERT INTO OrganizationMember (OrgID, UserID, JoinDate, OrgRole) VALUES
(1,  1,  '2023-02-14', 'Director'),
(1,  2,  '2024-03-01', 'Member'),
(1,  3,  '2024-05-12', 'Member'),
(1,  8,  '2023-09-30', 'Coordinator'),
(2,  4,  '2022-06-18', 'Director'),
(2,  6,  '2025-01-09', 'Member'),
(3,  7,  '2021-11-03', 'Coordinator'),
(3,  11, '2025-04-02', 'Member'),
(4,  12, '2025-09-05', 'Member'),
(4,  10, '2024-08-20', 'Officer'),
(5,  14, '2023-07-15', 'Member'),
(5,  13, '2022-03-22', 'Director'),
(6,  17, '2024-10-01', 'Member'),
(6,  16, '2023-01-11', 'Coordinator'),
(7,  30, '2025-02-28', 'Member'),
(8,  21, '2024-06-14', 'Member'),
(9,  22, '2025-08-25', 'Officer'),
(10, 18, '2023-04-04', 'Member'),
(10, 19, '2022-10-10', 'Coordinator'),
(11, 21, '2025-03-17', 'Member'),
(12, 29, '2024-12-01', 'Member'),
(13, 28, '2025-08-30', 'Member'),
(14, 25, '2023-05-21', 'Member'),
(15, 23, '2024-02-02', 'Member'),
(16, 26, '2025-06-06', 'Member'),
(17, 9,  '2024-09-09', 'Member'),
(18, 11, '2025-07-19', 'Member'),
(19, 19, '2024-01-15', 'Member'),
(20, 24, '2023-03-03', 'Coordinator'),
(20, 15, '2024-04-22', 'Member');

-- Registration (40)
INSERT INTO Registration (UserID, OpportunityID, RegistrationDate, Status, HoursLogged) VALUES
-- past events
(2,  1,  '2026-03-01', 'Completed', 4.0),
(3,  1,  '2026-03-05', 'Completed', 4.5),
(5,  1,  '2026-03-10', 'Cancelled', 0.0),
(6,  2,  '2026-03-20', 'Completed', 3.0),
(9,  2,  '2026-03-28', 'Completed', 3.0),
(11, 3,  '2026-04-10', 'Completed', 2.5),
(12, 4,  '2026-04-15', 'Completed', 5.0),
(14, 5,  '2026-04-30', 'Completed', 8.0),
(15, 5,  '2026-05-01', 'Completed', 8.0),
(17, 6,  '2026-05-20', 'Completed', 3.5),
(18, 7,  '2026-06-01', 'Completed', 6.0),
(20, 7,  '2026-06-02', 'Cancelled', 0.0),
(21, 8,  '2026-06-25', 'Completed', 2.0),
(23, 9,  '2026-07-10', 'Completed', 3.0),
(24, 9,  '2026-07-12', 'Completed', 3.0),
(25, 10, '2026-07-20', 'Completed', 2.5),
(26, 11, '2026-08-05', 'Completed', 4.0),
(27, 12, '2026-08-25', 'Completed', 5.5),
(8,  12, '2026-08-26', 'Completed', 5.5),
(28, 13, '2026-09-10', 'Completed', 4.0),
(29, 14, '2026-09-20', 'Completed', 2.0),
(30, 15, '2026-10-01', 'Completed', 3.0),
(2,  15, '2026-10-05', 'Cancelled', 0.0),
-- upcoming events
(3,  16, '2026-10-01', 'Confirmed', 0.0),
(5,  16, '2026-10-02', 'Confirmed', 0.0),
(15, 16, '2026-10-12', 'Pending',   0.0),
(24, 16, '2026-10-15', 'Confirmed', 0.0),
(6,  17, '2026-10-10', 'Confirmed', 0.0),
(17, 17, '2026-10-18', 'Pending',   0.0),
(11, 18, '2026-10-14', 'Confirmed', 0.0),
(19, 19, '2026-10-20', 'Pending',   0.0),
(12, 20, '2026-10-19', 'Pending',   0.0),
(3,  20, '2026-10-20', 'Pending',   0.0),
(21, 21, '2026-10-21', 'Pending',   0.0),
(9,  22, '2026-10-16', 'Confirmed', 0.0),
(26, 23, '2026-10-21', 'Pending',   0.0),
(14, 24, '2026-10-11', 'Confirmed', 0.0),
(18, 24, '2026-10-13', 'Cancelled', 0.0),
(27, 25, '2026-10-20', 'Pending',   0.0),
(23, 25, '2026-10-22', 'Pending',   0.0);

-- =====================================================================
--  PLANTING MAP EXTENSION
--  Where should more trees go? Each PlantingSite stores location and
--  canopy/heat measurements; the SitePriority view ranks them by need.
--  Volunteer events get map coordinates so coordinators can schedule
--  them anywhere on the map.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 8. TreeSpecies
-- ---------------------------------------------------------------------
CREATE TABLE TreeSpecies (
    SpeciesID       INT           NOT NULL AUTO_INCREMENT,
    CommonName      VARCHAR(60)   NOT NULL,
    ScientificName  VARCHAR(80)   NOT NULL,
    MatureHeightFt  SMALLINT      NOT NULL,
    Category        VARCHAR(20)   NOT NULL,
    CONSTRAINT PK_TreeSpecies PRIMARY KEY (SpeciesID),
    CONSTRAINT UQ_TreeSpecies_Scientific UNIQUE (ScientificName),
    CONSTRAINT CK_TreeSpecies_Category CHECK
        (Category IN ('Shade','Ornamental','Riparian','Evergreen'))
);

-- ---------------------------------------------------------------------
-- 9. PlantingSite  (Users 1 --Submits-- M PlantingSite)
-- ---------------------------------------------------------------------
CREATE TABLE PlantingSite (
    SiteID          INT           NOT NULL AUTO_INCREMENT,
    Name            VARCHAR(100)  NOT NULL,
    Latitude        DECIMAL(9,6)  NOT NULL,
    Longitude       DECIMAL(9,6)  NOT NULL,
    CanopyCoverPct  DECIMAL(4,1)  NOT NULL,
    ImperviousPct   DECIMAL(4,1)  NOT NULL,
    SurfaceTempF    DECIMAL(4,1)  NOT NULL,
    TreesNeeded     SMALLINT      NOT NULL,
    Status          VARCHAR(20)   NOT NULL DEFAULT 'Proposed',
    SubmittedBy     INT           NULL,
    SubmittedDate   DATE          NOT NULL,
    CONSTRAINT PK_PlantingSite PRIMARY KEY (SiteID),
    CONSTRAINT UQ_PlantingSite_Name UNIQUE (Name),
    CONSTRAINT FK_Site_User FOREIGN KEY (SubmittedBy)
        REFERENCES Users(UserID) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT CK_Site_Latitude  CHECK (Latitude  BETWEEN -90  AND 90),
    CONSTRAINT CK_Site_Longitude CHECK (Longitude BETWEEN -180 AND 180),
    CONSTRAINT CK_Site_Canopy     CHECK (CanopyCoverPct BETWEEN 0 AND 100),
    CONSTRAINT CK_Site_Impervious CHECK (ImperviousPct  BETWEEN 0 AND 100),
    CONSTRAINT CK_Site_Trees      CHECK (TreesNeeded > 0),
    CONSTRAINT CK_Site_Status CHECK (Status IN ('Proposed','Approved','Planted'))
);

-- ---------------------------------------------------------------------
-- 10. SiteRecommendation  (associative entity: PlantingSite M:N TreeSpecies)
-- ---------------------------------------------------------------------
CREATE TABLE SiteRecommendation (
    SiteID     INT       NOT NULL,
    SpeciesID  INT       NOT NULL,
    Quantity   SMALLINT  NOT NULL DEFAULT 1,
    CONSTRAINT PK_SiteRecommendation PRIMARY KEY (SiteID, SpeciesID),
    CONSTRAINT FK_Rec_Site FOREIGN KEY (SiteID)
        REFERENCES PlantingSite(SiteID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_Rec_Species FOREIGN KEY (SpeciesID)
        REFERENCES TreeSpecies(SpeciesID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT CK_Rec_Quantity CHECK (Quantity > 0)
);

-- Map location for each event, the planting area it serves (optional),
-- the coordinator who scheduled it (Users 1 --Schedules-- M Opportunity),
-- and optional directions or comments for volunteers
ALTER TABLE VolunteerOpportunity
    ADD COLUMN SiteID     INT           NULL,
    ADD COLUMN Latitude   DECIMAL(9,6)  NULL,
    ADD COLUMN Longitude  DECIMAL(9,6)  NULL,
    ADD COLUMN CreatedBy  INT           NULL,
    ADD COLUMN Notes      VARCHAR(500)  NULL,   -- directions or comments for volunteers
    ADD CONSTRAINT FK_Opportunity_Site FOREIGN KEY (SiteID)
        REFERENCES PlantingSite(SiteID) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT FK_Opportunity_Creator FOREIGN KEY (CreatedBy)
        REFERENCES Users(UserID) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT CK_Opportunity_Latitude  CHECK (Latitude  BETWEEN -90  AND 90),
    ADD CONSTRAINT CK_Opportunity_Longitude CHECK (Longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT CK_Opportunity_Coords CHECK ((Latitude IS NULL) = (Longitude IS NULL));

-- NeedScore (0-100) is derived, so it lives in a view instead of a column:
-- 50% missing canopy, 30% paved surface, 20% summer surface heat above 85F.
CREATE VIEW SitePriority AS
SELECT s.*,
       ROUND(0.5 * (100 - s.CanopyCoverPct)
           + 0.3 * s.ImperviousPct
           + 0.2 * LEAST(100, GREATEST(0, (s.SurfaceTempF - 85) * 4))) AS NeedScore
FROM PlantingSite s;

-- TreeSpecies (12) — native to southwest Virginia
INSERT INTO TreeSpecies (CommonName, ScientificName, MatureHeightFt, Category) VALUES
('Red Maple',         'Acer rubrum',             50, 'Shade'),
('White Oak',         'Quercus alba',            80, 'Shade'),
('Willow Oak',        'Quercus phellos',         60, 'Shade'),
('Eastern Redbud',    'Cercis canadensis',       25, 'Ornamental'),
('Flowering Dogwood', 'Cornus florida',          25, 'Ornamental'),
('American Sycamore', 'Platanus occidentalis',   90, 'Riparian'),
('River Birch',       'Betula nigra',            50, 'Riparian'),
('Tulip Poplar',      'Liriodendron tulipifera', 90, 'Shade'),
('Black Gum',         'Nyssa sylvatica',         50, 'Shade'),
('Serviceberry',      'Amelanchier arborea',     20, 'Ornamental'),
('Swamp White Oak',   'Quercus bicolor',         60, 'Riparian'),
('Eastern Red Cedar', 'Juniperus virginiana',    40, 'Evergreen');

-- PlantingSite (18) — sample sites around Blacksburg, VA (approximate locations)
INSERT INTO PlantingSite (Name, Latitude, Longitude, CanopyCoverPct, ImperviousPct, SurfaceTempF, TreesNeeded, Status, SubmittedBy, SubmittedDate) VALUES
('Downtown Main Street Corridor',  37.229600, -80.414200,  9.0, 88.0, 104.0, 30, 'Approved',  1, '2026-02-10'),
('North Main Retail Strip',        37.244500, -80.422000,  6.0, 92.0, 106.0, 40, 'Proposed',  4, '2026-03-02'),
('University City Blvd Lots',      37.239000, -80.427000,  7.0, 90.0, 105.0, 35, 'Proposed',  7, '2026-03-15'),
('Prices Fork Road Corridor',      37.233000, -80.434000, 14.0, 70.0, 101.0, 25, 'Approved',  2, '2026-01-22'),
('South Main Industrial Park',     37.205000, -80.406000,  5.0, 94.0, 108.0, 50, 'Proposed', 11, '2026-04-05'),
('Huckleberry Trail South',        37.212000, -80.413000, 32.0, 20.0,  92.0, 15, 'Approved',  3, '2026-02-28'),
('Municipal Park Edge',            37.220000, -80.423000, 41.0, 15.0,  90.0, 10, 'Planted',   1, '2025-10-04'),
('Heritage Park Meadow',           37.244000, -80.458000, 22.0,  8.0,  94.0, 60, 'Approved',  5, '2026-05-12'),
('Hethwood Neighborhood Streets',  37.224000, -80.451000, 28.0, 45.0,  96.0, 20, 'Planted',   8, '2025-09-18'),
('Patrick Henry Drive',            37.238000, -80.418000, 18.0, 60.0,  99.0, 18, 'Proposed', 12, '2026-06-01'),
('Toms Creek Road Medians',        37.247000, -80.438000, 20.0, 55.0,  98.0, 22, 'Proposed', 15, '2026-06-20'),
('Stroubles Creek Buffer',         37.216000, -80.438000, 25.0, 12.0,  91.0, 45, 'Approved',  2, '2026-03-08'),
('Downtown Surface Parking',       37.228500, -80.415500,  3.0, 97.0, 110.0, 12, 'Proposed', 20, '2026-07-14'),
('Gilbert Linkous School Grounds', 37.237000, -80.410000, 19.0, 50.0,  97.0, 16, 'Approved', 22, '2026-04-18'),
('Westside Residential Streets',   37.227500, -80.430000, 35.0, 40.0,  93.0, 14, 'Planted',  10, '2025-11-02'),
('Nellies Cave Park',              37.228000, -80.392000, 38.0, 10.0,  89.0,  8, 'Planted',  14, '2025-10-20'),
('Givens Lane Greenway',           37.256000, -80.425000, 26.0, 18.0,  93.0, 30, 'Proposed', 25, '2026-08-09'),
('Owens Street Neighborhood',      37.235000, -80.407000, 16.0, 58.0, 100.0, 20, 'Proposed', 28, '2026-09-03');

-- SiteRecommendation (36)
INSERT INTO SiteRecommendation (SiteID, SpeciesID, Quantity) VALUES
(1, 3, 15), (1, 4, 10), (1, 9, 5),
(2, 3, 20), (2, 1, 20),
(3, 1, 15), (3, 9, 10), (3, 10, 10),
(4, 2, 10), (4, 3, 15),
(5, 1, 20), (5, 12, 15), (5, 3, 15),
(6, 5, 8),  (6, 10, 7),
(7, 2, 5),  (7, 8, 5),
(8, 2, 20), (8, 8, 25), (8, 12, 15),
(9, 1, 10), (9, 4, 10),
(10, 3, 10), (10, 5, 8),
(11, 9, 12), (11, 4, 10),
(12, 6, 15), (12, 7, 15), (12, 11, 15),
(13, 3, 12),
(14, 2, 8), (14, 5, 8),
(15, 1, 14),
(16, 8, 8),
(17, 7, 15), (17, 11, 15);

-- Tie tree-related volunteer events to the sites they serve
UPDATE VolunteerOpportunity SET SiteID = 9  WHERE OpportunityID = 1;
UPDATE VolunteerOpportunity SET SiteID = 12 WHERE OpportunityID IN (2, 24);
UPDATE VolunteerOpportunity SET SiteID = 1  WHERE OpportunityID = 9;
UPDATE VolunteerOpportunity SET SiteID = 18 WHERE OpportunityID = 12;
UPDATE VolunteerOpportunity SET SiteID = 8  WHERE OpportunityID = 16;
UPDATE VolunteerOpportunity SET SiteID = 14 WHERE OpportunityID = 22;
UPDATE VolunteerOpportunity SET SiteID = 13 WHERE OpportunityID = 25;

-- Those events happen at their site, scheduled by one of the organization's coordinators
UPDATE VolunteerOpportunity v JOIN PlantingSite p ON p.SiteID = v.SiteID
SET v.Latitude  = p.Latitude,
    v.Longitude = p.Longitude,
    v.CreatedBy = (SELECT MIN(m.UserID) FROM OrganizationMember m
                   WHERE m.OrgID = v.OrgID AND m.OrgRole IN ('Coordinator','Officer','Director'));

-- =====================================================================
--  AUTHENTICATION
--  Passwords are stored only as scrypt hashes. Sample users have no
--  password until one is set with: npm run user:password -- <email>
-- =====================================================================

ALTER TABLE Users
    ADD COLUMN PasswordHash  VARCHAR(255)  NULL;

-- ---------------------------------------------------------------------
-- 11. RefreshToken  (Users 1 --Holds-- M RefreshToken; one per login session)
--     Only a SHA-256 hash of each token is stored. Tokens rotate on every
--     refresh; reusing a revoked token revokes all of that user's sessions.
-- ---------------------------------------------------------------------
CREATE TABLE RefreshToken (
    TokenID    INT       NOT NULL AUTO_INCREMENT,
    UserID     INT       NOT NULL,
    TokenHash  CHAR(64)  NOT NULL,
    CreatedAt  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt  DATETIME  NOT NULL,
    RevokedAt  DATETIME  NULL,
    CONSTRAINT PK_RefreshToken PRIMARY KEY (TokenID),
    CONSTRAINT UQ_RefreshToken_Hash UNIQUE (TokenHash),
    CONSTRAINT FK_RefreshToken_User FOREIGN KEY (UserID)
        REFERENCES Users(UserID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT CK_RefreshToken_Expiry CHECK (ExpiresAt > CreatedAt)
);

-- =====================================================================
--  VERIFICATION QUERIES (screenshot these results for your submission)
-- =====================================================================

-- Row counts per table
SELECT 'Organization' AS TableName, COUNT(*) AS RowsCount FROM Organization
UNION ALL SELECT 'Users',                COUNT(*) FROM Users
UNION ALL SELECT 'Role',                 COUNT(*) FROM Role
UNION ALL SELECT 'UserRole',             COUNT(*) FROM UserRole
UNION ALL SELECT 'VolunteerOpportunity', COUNT(*) FROM VolunteerOpportunity
UNION ALL SELECT 'OrganizationMember',   COUNT(*) FROM OrganizationMember
UNION ALL SELECT 'Registration',         COUNT(*) FROM Registration
UNION ALL SELECT 'TreeSpecies',          COUNT(*) FROM TreeSpecies
UNION ALL SELECT 'PlantingSite',         COUNT(*) FROM PlantingSite
UNION ALL SELECT 'SiteRecommendation',   COUNT(*) FROM SiteRecommendation
UNION ALL SELECT 'RefreshToken',         COUNT(*) FROM RefreshToken;

-- Total volunteer hours per user (joins across 2 tables)
SELECT u.UserID, CONCAT(u.FName, ' ', u.LName) AS Volunteer,
       SUM(r.HoursLogged) AS TotalHours
FROM Users u
JOIN Registration r ON r.UserID = u.UserID
GROUP BY u.UserID, Volunteer
ORDER BY TotalHours DESC;

-- Every opportunity with its organization and number of sign-ups
SELECT o.Name AS Organization, v.Title, v.EventDate,
       COUNT(r.RegistrationID) AS SignUps
FROM VolunteerOpportunity v
JOIN Organization o      ON o.OrgID = v.OrgID
LEFT JOIN Registration r ON r.OpportunityID = v.OpportunityID
GROUP BY v.OpportunityID, o.Name, v.Title, v.EventDate
ORDER BY v.EventDate;

-- Users with all their system roles
SELECT u.UserID, u.FName, u.LName,
       GROUP_CONCAT(ro.RoleName ORDER BY ro.RoleID SEPARATOR ', ') AS Roles
FROM Users u
JOIN UserRole ur ON ur.UserID = u.UserID
JOIN Role ro     ON ro.RoleID = ur.RoleID
GROUP BY u.UserID, u.FName, u.LName;

-- Planting sites ranked by need, with submitter and recommended trees
SELECT p.SiteID, p.Name, p.NeedScore, p.Status,
       CONCAT(u.FName, ' ', u.LName) AS SubmittedBy,
       GROUP_CONCAT(CONCAT(sr.Quantity, ' ', t.CommonName) SEPARATOR ', ') AS Recommended
FROM SitePriority p
LEFT JOIN Users u               ON u.UserID = p.SubmittedBy
LEFT JOIN SiteRecommendation sr ON sr.SiteID = p.SiteID
LEFT JOIN TreeSpecies t         ON t.SpeciesID = sr.SpeciesID
GROUP BY p.SiteID, p.Name, p.NeedScore, p.Status, u.FName, u.LName
ORDER BY p.NeedScore DESC;
