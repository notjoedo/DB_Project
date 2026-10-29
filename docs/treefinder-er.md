# Treefinder ER diagram

This is the proposed normalized logical data model for the complete Treefinder system, including nationwide vegetation intelligence. It is a design artifact, not a migration of the running app. The current implementation uses `profiles`, `records`, `registrations`, and `votes`; content such as sites, events, guides, and hours currently lives in typed JSON records.

General users, volunteers, certified arborists, and administrators share one user identity. Roles represent permissions; a person can hold more than one role. Arborist certifications have their own verification lifecycle. The current app uses one role per profile; multiple roles are a proposed extension.

## Overview

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : has
    ROLE ||--o{ USER_ROLE : assigns
    USER ||--o{ ARBORIST_CERTIFICATION : holds
    USER ||--o{ REGISTRATION : makes
    VOLUNTEER_OPPORTUNITY ||--o{ REGISTRATION : receives
    REGISTRATION ||--o{ VOLUNTEER_HOUR_LOG : tracks
    ORGANIZATION ||--o{ VOLUNTEER_OPPORTUNITY : hosts
    PLANTING_SITE |o--o{ VOLUNTEER_OPPORTUNITY : hosts
    PARK |o--o{ PLANTING_SITE : contains
    CLIMATE_ZONE |o--o{ PLANTING_SITE : classifies
    USER ||--o{ PLANTING_SITE : submits
    PLANTING_SITE ||--o{ SITE_RECOMMENDATION : receives
    TREE_SPECIES ||--o{ SITE_RECOMMENDATION : appears_in
    TREE_SPECIES ||--o{ SPECIES_CLIMATE_ZONE : tolerates
    CLIMATE_ZONE ||--o{ SPECIES_CLIMATE_ZONE : supports
    TREE_SPECIES ||--o{ SPECIES_ANIMAL : supports
    ANIMAL ||--o{ SPECIES_ANIMAL : depends_on
    USER ||--o| TREE_VOTE : casts
    TREE_SPECIES ||--o{ TREE_VOTE : receives
    USER ||--o{ FORUM_POST : writes
    FORUM_POST |o--o{ FORUM_POST : replies_to
    USER ||--o{ CARE_GUIDE : authors
    TREE_SPECIES |o--o{ CARE_GUIDE : concerns
    NDVI_DATASET ||--o{ NDVI_OBSERVATION : produces
    GEOSPATIAL_CELL ||--o{ NDVI_OBSERVATION : measures
    GEOSPATIAL_CELL ||--o{ SITE_CELL : overlaps
    PLANTING_SITE ||--o{ SITE_CELL : intersects
```

## Identity, volunteering, and community

```mermaid
erDiagram
    USER {
        string user_id PK
        string email UK
        string display_name
        string bio
        string account_status
        datetime created_at
    }
    ROLE {
        string role_id PK
        string name UK "general, volunteer, arborist, admin"
    }
    USER_ROLE {
        string user_id PK,FK
        string role_id PK,FK
        datetime granted_at
    }
    ARBORIST_CERTIFICATION {
        string certification_id PK
        string user_id FK
        string certification_number
        string issuing_body
        date expires_on
        string verification_status
        string verified_by_user_id FK "nullable; administrator"
        datetime verified_at "nullable"
    }
    ORGANIZATION {
        string organization_id PK
        string submitted_by_user_id FK
        string name
        string website
        string service_area
        string approval_status
        string reviewed_by_user_id FK "nullable; administrator"
    }
    VOLUNTEER_OPPORTUNITY {
        string opportunity_id PK
        string organization_id FK
        string site_id FK "nullable; not every event has a site"
        string submitted_by_user_id FK
        string title
        datetime starts_at
        datetime ends_at
        string timezone
        string location_description
        int capacity "nullable"
        string approval_status
        string reviewed_by_user_id FK "nullable; administrator"
    }
    REGISTRATION {
        string registration_id PK
        string user_id FK
        string opportunity_id FK
        string status "registered, cancelled, attended"
        datetime registered_at
    }
    VOLUNTEER_HOUR_LOG {
        string hour_log_id PK
        string registration_id FK
        date participation_date
        decimal hours
        string notes
        string approval_status
        string reviewed_by_user_id FK "nullable; administrator"
        datetime reviewed_at "nullable"
    }
    TREE_VOTE {
        string user_id PK,FK "one current favorite per user"
        string species_id FK
        datetime voted_at
    }
    FORUM_POST {
        string post_id PK
        string author_user_id FK
        string parent_post_id FK "nullable; question or reply"
        string title "nullable for replies"
        string body
        string moderation_status
        datetime created_at
    }
    CARE_GUIDE {
        string guide_id PK
        string author_user_id FK
        string species_id FK "nullable; general care guide"
        string title
        string body
        string publication_status
        datetime updated_at
    }

    USER ||--o{ USER_ROLE : has
    ROLE ||--o{ USER_ROLE : grants
    USER ||--o{ ARBORIST_CERTIFICATION : holds
    USER |o--o{ ARBORIST_CERTIFICATION : verifies
    USER ||--o{ ORGANIZATION : submits
    ORGANIZATION ||--o{ VOLUNTEER_OPPORTUNITY : hosts
    PLANTING_SITE |o--o{ VOLUNTEER_OPPORTUNITY : hosts
    USER ||--o{ VOLUNTEER_OPPORTUNITY : submits
    USER ||--o{ REGISTRATION : makes
    VOLUNTEER_OPPORTUNITY ||--o{ REGISTRATION : receives
    REGISTRATION ||--o{ VOLUNTEER_HOUR_LOG : records
    USER ||--o| TREE_VOTE : casts
    TREE_SPECIES ||--o{ TREE_VOTE : receives
    USER ||--o{ FORUM_POST : writes
    FORUM_POST |o--o{ FORUM_POST : replies_to
    USER ||--o{ CARE_GUIDE : authors
    TREE_SPECIES |o--o{ CARE_GUIDE : concerns
```

## Species, wildlife, and planting sites

```mermaid
erDiagram
    TREE_SPECIES {
        string species_id PK
        string scientific_name UK
        string common_name
        string growth_habit
        decimal mature_height_ft
        decimal mature_spread_ft
        string soil_requirements
        string sunlight_requirements
        string water_needs
        string native_range
        string source_url
        string created_by_user_id FK
        string verification_status
        string verified_by_user_id FK "nullable; arborist or admin"
        datetime updated_at
    }
    CLIMATE_ZONE {
        string climate_zone_id PK
        string code UK "USDA hardiness zone, e.g. 7b"
        decimal minimum_temperature_f
        decimal maximum_temperature_f
    }
    SPECIES_CLIMATE_ZONE {
        string species_id PK,FK
        string climate_zone_id PK,FK
    }
    ANIMAL {
        string animal_id PK
        string common_name
        string scientific_name "nullable for wildlife groups"
        string category "bird, mammal, insect, other"
        boolean is_pollinator
    }
    SPECIES_ANIMAL {
        string species_id PK,FK
        string animal_id PK,FK
        string dependency_type PK "food, shelter, pollination, host plant"
        string description
        string source_url
    }
    PARK {
        string park_id PK
        string name
        string managing_authority
        string city
        string state_code
        string boundary_geojson "nullable"
    }
    PLANTING_SITE {
        string site_id PK
        string submitted_by_user_id FK
        string park_id FK "nullable"
        string climate_zone_id FK "nullable; unknown until assessed"
        string name
        decimal latitude
        decimal longitude
        string boundary_geojson "nullable"
        string state_code
        string soil_type "nullable"
        string sunlight "nullable"
        string water_availability "nullable"
        decimal available_canopy_width_ft "nullable"
        string planting_priority "nullable; assessed independently"
        string approval_status
        string reviewed_by_user_id FK "nullable; arborist or admin"
        datetime assessed_at "nullable"
    }
    SITE_RECOMMENDATION {
        string site_id PK,FK
        string species_id PK,FK
        decimal compatibility_score
        string rationale
        string algorithm_version
        datetime computed_at
    }

    USER ||--o{ TREE_SPECIES : contributes
    USER ||--o{ PLANTING_SITE : submits
    PARK |o--o{ PLANTING_SITE : contains
    CLIMATE_ZONE |o--o{ PLANTING_SITE : classifies
    TREE_SPECIES ||--o{ SPECIES_CLIMATE_ZONE : tolerates
    CLIMATE_ZONE ||--o{ SPECIES_CLIMATE_ZONE : supports
    TREE_SPECIES ||--o{ SPECIES_ANIMAL : supports
    ANIMAL ||--o{ SPECIES_ANIMAL : depends_on
    PLANTING_SITE ||--o{ SITE_RECOMMENDATION : receives
    TREE_SPECIES ||--o{ SITE_RECOMMENDATION : appears_in
```

## Nationwide satellite intelligence

```mermaid
erDiagram
    NDVI_DATASET {
        string dataset_id PK
        string provider
        string product_name
        string source_catalog_url
        decimal native_resolution_m
        string processing_version
        string compositing_method
    }
    GEOSPATIAL_CELL {
        string cell_id PK
        string grid_scheme
        string grid_code
        string boundary_geojson
        string crs
    }
    NDVI_OBSERVATION {
        string dataset_id PK,FK
        string cell_id PK,FK
        datetime period_start PK
        datetime period_end PK
        decimal mean_ndvi "nullable; no usable pixels"
        decimal valid_pixel_fraction
        int valid_pixel_count
        string source_scene_ids_json
        string raster_url "nullable"
        datetime processed_at
    }
    SITE_CELL {
        string site_id PK,FK
        string cell_id PK,FK
        decimal overlap_area_m2
    }

    NDVI_DATASET ||--o{ NDVI_OBSERVATION : produces
    GEOSPATIAL_CELL ||--o{ NDVI_OBSERVATION : measures
    GEOSPATIAL_CELL ||--o{ SITE_CELL : overlaps
    PLANTING_SITE ||--o{ SITE_CELL : intersects
```

The NDVI tables are proposed storage for future numeric satellite processing. Today's NASA map tiles are visual imagery, and Sentinel-2 discovery returns source scene metadata; neither currently populates these tables. Keep source resolution, composite dates, and usable-pixel coverage with every measurement. Missing imagery must remain unknown rather than receiving a zero score. NDVI describes vegetation greenness and must not automatically determine site approval, tree canopy, or plantability.

## Cardinality and constraints

- `||` = exactly one; `o|` or `|o` = zero or one; `o{` = zero or many. `PK` identifies a primary key, `FK` a foreign key, and `UK` a unique key. Multiple `PK` fields form a composite key.
- Every registration belongs to one user and one opportunity. Enforce uniqueness on `(user_id, opportunity_id)`; cancellation updates its status instead of creating another registration.
- Each hour log belongs to a registration, which already identifies both the volunteer and event. Sum approved logs to calculate verified participation hours. Validate positive hours, event dates, and prevent duplicate claims through review.
- A user can have at most one current favorite-tree vote. Changing the favorite updates that row.
- Species-to-zone, species-to-animal, site-to-species, and site-to-grid-cell relationships use junction tables for many-to-many associations.
- Sites may be outside parks and may have unknown growing conditions. Events may be held at a location that has no planting-site record.
- Approvals belong to their subject records. Nullable reviewer foreign keys point to `USER`; authorization checks restrict organization, opportunity, certification, and hour approvals to administrators, and species/site review to authorized arborists or administrators.
- Forum replies point to a parent post. Prevent parent cycles and orphan replies. A verified-arborist badge derives from the author's verified, unexpired certification and authorized role; users cannot set it themselves.
- Recommendations record the assessment method and time. They guide species exploration and require local review before planting.
- Treat geometry representation and spatial indexes as implementation choices. This logical model does not assume a spatial database extension is available in the current Cloudflare D1 deployment.
