-- MySQL dump 10.13  Distrib 26.10.0, for macos26.6 (arm64)
--
-- Host: 127.0.0.1    Database: volunteer_db
-- ------------------------------------------------------
-- Server version	26.10.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `volunteer_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `volunteer_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `volunteer_db`;

--
-- Table structure for table `Organization`
--

DROP TABLE IF EXISTS `Organization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Organization` (
  `OrgID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Type` varchar(30) NOT NULL,
  `ContactEmail` varchar(100) NOT NULL,
  PRIMARY KEY (`OrgID`),
  UNIQUE KEY `UQ_Organization_Name` (`Name`),
  UNIQUE KEY `UQ_Organization_Email` (`ContactEmail`),
  CONSTRAINT `CK_Organization_Type` CHECK ((`Type` in (_utf8mb4'Nonprofit',_utf8mb4'Government',_utf8mb4'School',_utf8mb4'Community Group',_utf8mb4'Business')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `OrganizationMember`
--

DROP TABLE IF EXISTS `OrganizationMember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrganizationMember` (
  `MembershipID` int NOT NULL AUTO_INCREMENT,
  `OrgID` int NOT NULL,
  `UserID` int NOT NULL,
  `JoinDate` date NOT NULL,
  `OrgRole` varchar(30) NOT NULL DEFAULT 'Member',
  PRIMARY KEY (`MembershipID`),
  UNIQUE KEY `UQ_Member_OrgUser` (`OrgID`,`UserID`),
  KEY `FK_Member_User` (`UserID`),
  CONSTRAINT `FK_Member_Org` FOREIGN KEY (`OrgID`) REFERENCES `Organization` (`OrgID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Member_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CK_Member_OrgRole` CHECK ((`OrgRole` in (_utf8mb4'Member',_utf8mb4'Coordinator',_utf8mb4'Officer',_utf8mb4'Director')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `PlantingSite`
--

DROP TABLE IF EXISTS `PlantingSite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PlantingSite` (
  `SiteID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Latitude` decimal(9,6) NOT NULL,
  `Longitude` decimal(9,6) NOT NULL,
  `CanopyCoverPct` decimal(4,1) NOT NULL,
  `ImperviousPct` decimal(4,1) NOT NULL,
  `SurfaceTempF` decimal(4,1) NOT NULL,
  `TreesNeeded` smallint NOT NULL,
  `Status` varchar(20) NOT NULL DEFAULT 'Proposed',
  `SubmittedBy` int DEFAULT NULL,
  `SubmittedDate` date NOT NULL,
  PRIMARY KEY (`SiteID`),
  UNIQUE KEY `UQ_PlantingSite_Name` (`Name`),
  KEY `FK_Site_User` (`SubmittedBy`),
  CONSTRAINT `FK_Site_User` FOREIGN KEY (`SubmittedBy`) REFERENCES `Users` (`UserID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CK_Site_Canopy` CHECK ((`CanopyCoverPct` between 0 and 100)),
  CONSTRAINT `CK_Site_Impervious` CHECK ((`ImperviousPct` between 0 and 100)),
  CONSTRAINT `CK_Site_Latitude` CHECK ((`Latitude` between -(90) and 90)),
  CONSTRAINT `CK_Site_Longitude` CHECK ((`Longitude` between -(180) and 180)),
  CONSTRAINT `CK_Site_Status` CHECK ((`Status` in (_utf8mb4'Proposed',_utf8mb4'Approved',_utf8mb4'Planted'))),
  CONSTRAINT `CK_Site_Trees` CHECK ((`TreesNeeded` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `RefreshToken`
--

DROP TABLE IF EXISTS `RefreshToken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `RefreshToken` (
  `TokenID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL,
  `TokenHash` char(64) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ExpiresAt` datetime NOT NULL,
  `RevokedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`TokenID`),
  UNIQUE KEY `UQ_RefreshToken_Hash` (`TokenHash`),
  KEY `FK_RefreshToken_User` (`UserID`),
  CONSTRAINT `FK_RefreshToken_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CK_RefreshToken_Expiry` CHECK ((`ExpiresAt` > `CreatedAt`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Registration`
--

DROP TABLE IF EXISTS `Registration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Registration` (
  `RegistrationID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL,
  `OpportunityID` int NOT NULL,
  `RegistrationDate` date NOT NULL,
  `Status` varchar(20) NOT NULL DEFAULT 'Pending',
  `HoursLogged` decimal(4,1) NOT NULL DEFAULT '0.0',
  PRIMARY KEY (`RegistrationID`),
  UNIQUE KEY `UQ_Registration_UserOpp` (`UserID`,`OpportunityID`),
  KEY `FK_Registration_Opp` (`OpportunityID`),
  CONSTRAINT `FK_Registration_Opp` FOREIGN KEY (`OpportunityID`) REFERENCES `VolunteerOpportunity` (`OpportunityID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Registration_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CK_Registration_Hours` CHECK ((`HoursLogged` between 0 and 24)),
  CONSTRAINT `CK_Registration_Status` CHECK ((`Status` in (_utf8mb4'Pending',_utf8mb4'Confirmed',_utf8mb4'Cancelled',_utf8mb4'Completed')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Role`
--

DROP TABLE IF EXISTS `Role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Role` (
  `RoleID` tinyint NOT NULL,
  `RoleName` varchar(20) NOT NULL,
  PRIMARY KEY (`RoleID`),
  UNIQUE KEY `UQ_Role_Name` (`RoleName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `SitePriority`
--

DROP TABLE IF EXISTS `SitePriority`;
/*!50001 DROP VIEW IF EXISTS `SitePriority`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `SitePriority` AS SELECT 
 1 AS `SiteID`,
 1 AS `Name`,
 1 AS `Latitude`,
 1 AS `Longitude`,
 1 AS `CanopyCoverPct`,
 1 AS `ImperviousPct`,
 1 AS `SurfaceTempF`,
 1 AS `TreesNeeded`,
 1 AS `Status`,
 1 AS `SubmittedBy`,
 1 AS `SubmittedDate`,
 1 AS `NeedScore`,
 1 AS `UpcomingEvents`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `SiteRecommendation`
--

DROP TABLE IF EXISTS `SiteRecommendation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `SiteRecommendation` (
  `SiteID` int NOT NULL,
  `SpeciesID` int NOT NULL,
  `Quantity` smallint NOT NULL DEFAULT '1',
  PRIMARY KEY (`SiteID`,`SpeciesID`),
  KEY `FK_Rec_Species` (`SpeciesID`),
  CONSTRAINT `FK_Rec_Site` FOREIGN KEY (`SiteID`) REFERENCES `PlantingSite` (`SiteID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Rec_Species` FOREIGN KEY (`SpeciesID`) REFERENCES `TreeSpecies` (`SpeciesID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CK_Rec_Quantity` CHECK ((`Quantity` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `TreeSpecies`
--

DROP TABLE IF EXISTS `TreeSpecies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TreeSpecies` (
  `SpeciesID` int NOT NULL AUTO_INCREMENT,
  `CommonName` varchar(60) NOT NULL,
  `ScientificName` varchar(80) NOT NULL,
  `MatureHeightFt` smallint NOT NULL,
  `Category` varchar(20) NOT NULL,
  PRIMARY KEY (`SpeciesID`),
  UNIQUE KEY `UQ_TreeSpecies_Scientific` (`ScientificName`),
  CONSTRAINT `CK_TreeSpecies_Category` CHECK ((`Category` in (_utf8mb4'Shade',_utf8mb4'Ornamental',_utf8mb4'Riparian',_utf8mb4'Evergreen')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `UserRole`
--

DROP TABLE IF EXISTS `UserRole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserRole` (
  `UserID` int NOT NULL,
  `RoleID` tinyint NOT NULL,
  PRIMARY KEY (`UserID`,`RoleID`),
  KEY `FK_UserRole_Role` (`RoleID`),
  CONSTRAINT `FK_UserRole_Role` FOREIGN KEY (`RoleID`) REFERENCES `Role` (`RoleID`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FK_UserRole_User` FOREIGN KEY (`UserID`) REFERENCES `Users` (`UserID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `FName` varchar(50) NOT NULL,
  `LName` varchar(50) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `PasswordHash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `UQ_Users_Email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `VolunteerOpportunity`
--

DROP TABLE IF EXISTS `VolunteerOpportunity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `VolunteerOpportunity` (
  `OpportunityID` int NOT NULL AUTO_INCREMENT,
  `OrgID` int NOT NULL,
  `Title` varchar(150) NOT NULL,
  `EventDate` date NOT NULL,
  `Location` varchar(150) NOT NULL,
  `SiteID` int DEFAULT NULL,
  `Latitude` decimal(9,6) DEFAULT NULL,
  `Longitude` decimal(9,6) DEFAULT NULL,
  `CreatedBy` int DEFAULT NULL,
  `Notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`OpportunityID`),
  KEY `FK_Opportunity_Org` (`OrgID`),
  KEY `FK_Opportunity_Site` (`SiteID`),
  KEY `FK_Opportunity_Creator` (`CreatedBy`),
  CONSTRAINT `FK_Opportunity_Creator` FOREIGN KEY (`CreatedBy`) REFERENCES `Users` (`UserID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_Opportunity_Org` FOREIGN KEY (`OrgID`) REFERENCES `Organization` (`OrgID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_Opportunity_Site` FOREIGN KEY (`SiteID`) REFERENCES `PlantingSite` (`SiteID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CK_Opportunity_Coords` CHECK (((`Latitude` is null) = (`Longitude` is null))),
  CONSTRAINT `CK_Opportunity_Latitude` CHECK ((`Latitude` between -(90) and 90)),
  CONSTRAINT `CK_Opportunity_Longitude` CHECK ((`Longitude` between -(180) and 180))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'volunteer_db'
--

--
-- Dumping routines for database 'volunteer_db'
--

--
-- Current Database: `volunteer_db`
--

USE `volunteer_db`;

--
-- Final view structure for view `SitePriority`
--

/*!50001 DROP VIEW IF EXISTS `SitePriority`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50001 VIEW `SitePriority` AS select `s`.`SiteID` AS `SiteID`,`s`.`Name` AS `Name`,`s`.`Latitude` AS `Latitude`,`s`.`Longitude` AS `Longitude`,`s`.`CanopyCoverPct` AS `CanopyCoverPct`,`s`.`ImperviousPct` AS `ImperviousPct`,`s`.`SurfaceTempF` AS `SurfaceTempF`,`s`.`TreesNeeded` AS `TreesNeeded`,`s`.`Status` AS `Status`,`s`.`SubmittedBy` AS `SubmittedBy`,`s`.`SubmittedDate` AS `SubmittedDate`,round(((0.8 * ((0.6 * (100 - `s`.`CanopyCoverPct`)) + (0.4 * `s`.`ImperviousPct`))) + (0.2 * least(100,greatest(0,((`s`.`SurfaceTempF` - 85) * 4))))),0) AS `NeedScore`,(select count(0) from `VolunteerOpportunity` `v` where ((`v`.`SiteID` = `s`.`SiteID`) and (`v`.`EventDate` >= curdate()))) AS `UpcomingEvents` from `PlantingSite` `s` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-23 20:08:27
