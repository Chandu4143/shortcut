> **Status: original product proposal, kept for history — not the current architecture.**
> This document is the PRD written before the first build. The shipped app differs in three important ways:
> routing runs on Valhalla (`valhalla1.openstreetmap.de`) with an OpenStreetMap Overpass fallback instead of a
> self-hosted GraphHopper instance; there is no Node/Fastify backend, Supabase database, PostGIS or account
> system — the app calls public endpoints and keeps saved places and recent trips on the device; and the map
> is rendered with MapLibre against OpenFreeMap tiles. Every GraphHopper, backend and database reference below
> describes the plan, not the implementation. For what actually ships, see [README.md](README.md); for what
> data the app sends, see the
> [privacy and limitations page](https://chandu4143.github.io/shortcut/privacy.html).

I would approach **Short Cut** as a real navigation product, not just a Google Maps alternative with a different routing algorithm.

The central philosophy should be:

> Google Maps tries to get you there efficiently. Short Cut tries to get you there using the least possible distance.

I'm going to make the important product decisions myself, establish some assumptions, and then write a development-ready PRD. I'll use your Blinkit experience as the inspiration and Hyderabad as the initial launch market.

# SHORT CUT — Product Requirements Document

**Product:** Short Cut  
**Category:** Navigation & Mapping  
**Platform:** Android first, iOS later  
**Initial Market:** Hyderabad, India  
**Document Version:** 1.0  
**Status:** Product definition / MVP planning

---

# Part 1: Important product questions (with decisions)

These are the questions I'd normally ask before starting development. I've answered them based on the concept you've described.

### 1. What exactly is Short Cut?

**Decision:** A distance-first navigation application.

Most navigation applications offer routes based on travel time, road preferences, traffic, and other factors.

Short Cut makes total route distance its primary optimization objective.

For example:

| Navigation | Distance | Estimated time |
|---|---:|---:|
| Google Maps | 3.2 km | 9 min |
| Alternative route | 2.6 km | 8 min |
| Short Cut | 1.7 km | 7 min |

The app should clearly show how much distance the user saves.

### 2. Should it prioritize shortest distance or fastest time?

**Decision: Shortest distance. Always.**

This is the defining characteristic of the product.

The routing engine should minimize the total distance travelled, not the estimated time.

Travel time should still be calculated and displayed, but it should not determine the primary route.

Users can optionally compare the shortest route with the fastest alternative.

### 3. Should Short Cut include narrow roads, small streets, and alleys?

**Decision: Absolutely.**

The application should make extensive use of available OpenStreetMap data.

It should prioritize discovering shorter connections through:

- Narrow public streets.
- Small residential roads.
- Public pedestrian passages.
- Mapped connecting lanes.
- Internal public roads.
- Roads that conventional navigation might not prioritize.

The app should not automatically reject a road just because it is narrow or has a poor surface.

Where surface information is available, display it to the user.

### 4. Should it show illegal routes?

**Decision: No illegal turn-by-turn navigation, but aggressive distance optimization.**

There is an important distinction.

Short Cut should not deliberately direct a motorcycle against one-way traffic, through restricted roads, or across prohibited areas.

However, it should not unnecessarily favor wider, more comfortable roads when a shorter, permitted connection exists.

The routing engine should follow applicable access restrictions and road-direction rules. Hyderabad Traffic Police explicitly identifies one-way restrictions and mandatory road signs as regulatory requirements. [HTP](https://www.htp.gov.in/road_rules.html?utm_source=chatgpt.com)

The product can also display geometric distance information separately from usable routes.

### 5. Who is the initial target audience?

**Decision: Delivery riders and everyday commuters.**

Primary users:

- Blinkit delivery partners.
- Zomato delivery partners.
- Swiggy delivery partners.
- Dunzo-style delivery workers.
- Motorcycle commuters.
- People travelling short distances within cities.

Secondary users:

- Pedestrians.
- Cyclists.
- People exploring unfamiliar neighborhoods.

Delivery riders are an excellent initial audience because even small distance savings can matter when travelling repeatedly throughout a working day.

### 6. Which transportation modes should we support?

**Decision: Launch with two-wheeler navigation.**

This matches the original inspiration.

| Mode | Priority |
|---|---|
| Two-wheeler | P0 |
| Walking | P1 |
| Bicycle | P2 |
| Car | P2 |

The underlying routing architecture should support multiple profiles, even if the first release only exposes two-wheeler navigation.

Each profile must respect its applicable access restrictions.

### 7. Should the app provide live navigation?

**Decision: Yes.**

A route calculator alone would be too limited.

Short Cut should eventually include:

- Real-time GPS tracking.
- Live route progress.
- Distance remaining.
- Estimated arrival time.
- Voice navigation.
- Automatic rerouting.
- Off-route detection.

The first MVP can introduce basic live navigation, with more sophisticated voice guidance developed afterward.

### 8. Should users be able to suggest shortcuts?

**Decision: Yes, but not in the first release.**

This could become one of Short Cut's biggest competitive advantages.

Imagine a delivery rider discovers a small public connecting road that is missing from the map.

They could submit it for verification.

Once verified, the connection can become available to other users.

Eventually, Short Cut could build a community-maintained collection of useful local shortcuts.

### 9. Should we use Google Maps APIs?

**Decision: No, not for the core routing engine.**

The product should have control over its own routing logic.

Recommended foundations:

- OpenStreetMap for map data.
- GraphHopper for routing.
- MapLibre for map rendering.

GraphHopper supports configurable routing weightings, including shortest-path calculations. This makes it suitable for implementing the central concept. [GitHub](https://github.com/graphhopper/graphhopper/blob/master/docs/core/weighting.md?utm_source=chatgpt.com)

### 10. What should make Short Cut different?

**Decision: Shortest-route discovery should be the entire product identity.**

Not another navigation application with dozens of features.

Every major product decision should support one objective:

**Find the shortest usable route between two locations.**

---

# Part 2: Product Requirements Document

## 1. Product Overview

### 1.1 Product Description

Short Cut is a mobile navigation application designed to find the shortest traversable route between two geographical locations.

Unlike navigation applications that commonly prioritize estimated travel time or practical road preferences, Short Cut prioritizes minimum travel distance.

The application uses geographical road-network data, custom routing algorithms, and GPS positioning to identify shorter connections between locations.

It is designed particularly for urban environments with complex road networks, narrow residential streets, and multiple possible connections between destinations.

### 1.2 Product Vision

Make travelling shorter.

Short Cut aims to help people discover routes they might otherwise overlook.

### 1.3 Mission

Build a navigation system where distance is the primary optimization objective.

### 1.4 Brand Identity

**Name:** Short Cut

**Tagline:** The shortest way there.

Alternative taglines:

- Less distance. More destination.
- Find the shorter way.
- Stop taking the long way.
- Your destination, closer than you think.

---

# 2. Target Audience

### Primary Audience: Delivery Riders

People who regularly travel between multiple locations throughout their working day.

Their requirements include:

- Shorter travel distances.
- Simple navigation.
- Minimal interaction while travelling.
- Accurate location positioning.
- Fast route recalculation.
- Easy-to-understand directions.

### Secondary Audience: Everyday Commuters

People who want to minimize the distance they travel between common destinations.

### Geographic Focus

Initial launch:

Hyderabad, Telangana, India.

Expansion:

1. Other major Telangana cities.
2. Bengaluru.
3. Chennai.
4. Mumbai.
5. Other Indian metropolitan cities.
6. International expansion.

---

# 3. Core Product Principles

These principles should guide development.

**Principle 1: Distance comes first.**

The primary route must minimize total traversable distance.

**Principle 2: Do not unnecessarily reject shorter public roads.**

Narrow roads, rough surfaces, and residential streets should remain eligible when they are permitted for the selected transportation mode.

**Principle 3: Respect physical and legal restrictions.**

The routing engine must not instruct users to travel against one-way restrictions, enter prohibited roads, cross railway tracks improperly, or enter restricted private properties.

**Principle 4: Be transparent about route quality.**

Users should understand when a route contains unpaved surfaces, narrow roads, or uncertain map information.

**Principle 5: Navigation must be practical.**

A mathematically shortest route is useless if the user cannot actually travel along it.

---

# 4. Core Features and Functional Requirements

## 4.1 Interactive Map

**Priority: P0**

The home screen should primarily consist of an interactive map.

Required functionality:

- Display the user's current location.
- Display nearby roads and streets.
- Support zooming and map rotation.
- Show the destination.
- Display calculated routes.
- Highlight the selected route.
- Show alternative routes.
- Display the map scale.
- Provide map attribution.

Map appearance:

- Clean.
- Minimal.
- Modern.
- High contrast.
- Navigation-focused.

The map should not feel overcrowded.

## 4.2 Location Detection

**Priority: P0**

The application should request location permission and determine the user's current location.

Requirements:

- Current GPS coordinates.
- Location accuracy.
- Location update frequency appropriate to navigation.
- Location permission handling.
- Manual starting-point selection.
- Re-centering on current location.
- Handling of weak GPS signals.

When GPS accuracy is poor, the application should communicate that clearly.

## 4.3 Destination Search

**Priority: P0**

Users must be able to search for destinations.

Features:

- Address search.
- Landmark search.
- Local business and place search.
- Recent destinations.
- Saved destinations.
- Map-based destination selection.

Search should support Indian addresses and commonly used local place names.

Autocomplete should be implemented through a geocoding provider with appropriate production usage rights.

Do not build a commercial product dependent on unrestricted use of public OpenStreetMap search infrastructure. Its public Nominatim service has specific rate and application restrictions. [OSM Foundation Operations](https://operations.osmfoundation.org/policies/nominatim/?utm_source=chatgpt.com)

## 4.4 Shortest Route Engine

**Priority: P0 — Most Important Feature**

This is the heart of Short Cut.

The routing engine must calculate routes based primarily on total distance.

### Routing logic

Represent the road network as a graph.

Each graph contains:

- Nodes: Intersections and connecting points.
- Edges: Roads and paths connecting nodes.
- Edge distance: Length of each connection.
- Access restrictions: Which transportation modes can use the connection.
- Direction restrictions: Whether the connection is one-way.
- Road attributes: Surface, type, and other available information.

The optimization objective:

`Minimize Total Distance = Σ Distance of Every Traversed Edge`

Subject to:

- The route is connected.
- The selected transportation mode is permitted.
- Road access restrictions are respected.
- One-way restrictions are respected.
- Prohibited connections are excluded.
- Known closed or blocked roads are excluded.

Use Dijkstra's algorithm or A* through the routing engine.

### Expected behavior

Suppose the user is travelling between locations A and B.

There are three possible routes:

| Route | Distance | Estimated time |
|---|---:|---:|
| Main road | 3.5 km | 8 min |
| Residential streets | 2.4 km | 9 min |
| Connecting lanes | 1.8 km | 7 min |

Short Cut should select the 1.8 km route.

The application must not select the main road simply because it is wider or more convenient.

### Additional routing requirements

- Calculate multiple alternative routes.
- Rank routes by distance.
- Identify the shortest route.
- Calculate estimated travel time separately.
- Display distance savings.
- Handle disconnected roads.
- Handle missing road connections gracefully.
- Recalculate when the destination changes.

## 4.5 Route Comparison

**Priority: P0**

This is an important feature.

Users should be able to compare the shortest route with a conventional fastest-route alternative.

Example:

**SHORT CUT ROUTE**

1.7 km

7 minutes

**FASTEST ALTERNATIVE**

2.8 km

6 minutes

**YOU SAVE**

1.1 km

The comparison should make the product's primary advantage immediately obvious.

The fastest alternative should never replace the shortest route as the default selection.

## 4.6 Live Navigation

**Priority: P0/P1**

Once the user selects a route, they should be able to start navigation.

Navigation screen:

- Current location.
- Highlighted route.
- Next maneuver.
- Distance to next maneuver.
- Remaining distance.
- Estimated arrival time.
- Navigation status.
- Recenter button.
- End navigation button.

### Automatic rerouting

When the user deviates from the selected route:

1. Detect departure from the route.
2. Determine the updated position.
3. Recalculate the shortest usable route to the destination.
4. Display the updated route.
5. Update remaining distance and ETA.

Avoid excessive rerouting caused by normal GPS fluctuations.

## 4.7 Road Information

**Priority: P1**

Display available road information.

Possible attributes:

- Road type.
- Surface type.
- Road width, when mapped.
- Access restrictions.
- One-way restrictions.
- Rough or unpaved surface.
- Missing or uncertain road information.

Short Cut should not reject a permitted route simply because its surface is poor.

However, relevant road warnings should remain visible.

## 4.8 Shortcut Discovery

**Priority: P2**

A future community-driven feature.

Users can report:

- Missing roads.
- Missing connecting paths.
- Incorrect road directions.
- Incorrect road access restrictions.
- Closed roads.
- Incorrect road information.

Submissions should be reviewed and verified before affecting general routing.

This feature could eventually become a valuable source of local map improvements.

---

# 5. User Interface and User Experience

## 5.1 Home Screen

The home screen should be map-first.

Suggested layout:

**Top section**

Search destination bar.

Placeholder:

"Where do you want to go?"

**Middle section**

Full-screen interactive map.

Current location marker.

**Bottom section**

A compact navigation panel containing:

- Starting location.
- Destination.
- Transportation mode.
- FIND SHORTEST ROUTE button.

The interface should be minimal.

Users should be able to calculate a route without navigating through multiple screens.

## 5.2 Route Results Screen

Once a route is calculated, show:

**THE SHORTEST ROUTE**

1.7 km

7 min estimated

Distance saved: 1.1 km

Buttons:

- START NAVIGATION
- ALTERNATIVE ROUTES
- ROUTE DETAILS

The selected shortest route should be visually prominent.

## 5.3 Navigation Screen

During navigation, the map should occupy most of the screen.

A navigation information panel should display:

- Next turn.
- Distance remaining.
- ETA.
- Total route distance.

Avoid unnecessary animations and large UI elements.

The interface should be usable while mounted on a motorcycle.

## 5.4 Design Direction

Recommended visual direction:

- Dark navigation theme.
- High-contrast route lines.
- Minimal typography.
- Modern map controls.
- Clear GPS location marker.
- Compact bottom sheets.

Suggested colors:

| Element | Color |
|---|---|
| Background | #101318 |
| Primary route | #36D399 |
| Alternative route | #64748B |
| Destination | #F59E0B |
| Text | #FFFFFF |
| Secondary text | #9CA3AF |

These are initial design tokens, not final branding decisions.

---

# 6. Technical Architecture

This is the stack I recommend.

| Layer | Technology | Responsibility |
|---|---|---|
| Mobile | React Native + Expo | Mobile application |
| Language | TypeScript | Application development |
| Maps | MapLibre React Native | Interactive map rendering |
| Map data | OpenStreetMap | Road network data |
| Routing | GraphHopper | Route calculation |
| Backend API | Node.js + Fastify | Application API |
| Database | Supabase PostgreSQL | User data and application records |
| Geospatial | PostGIS | Geographic queries |
| GPS | Expo Location | Current user location |
| Authentication | Supabase Auth | User accounts |
| Hosting | VPS / Cloud infrastructure | Backend and routing services |

### Important implementation note

MapLibre React Native currently requires a development build rather than Expo Go. Its official Expo setup documents the required config plugin and rebuild process. [MapLibre](https://maplibre.org/maplibre-react-native/docs/setup/expo/?utm_source=chatgpt.com)

### 6.1 Mapping Infrastructure

Use OpenStreetMap as the initial geographical data source.

It provides community-maintained information about roads, paths, and other geographical features.

However, map data must be validated because coverage and accuracy vary between locations.

OpenStreetMap data is distributed under the ODbL license, so Short Cut must provide appropriate attribution and comply with its licensing requirements. [OpenStreetMap](https://www.openstreetmap.org/copyright?utm_source=chatgpt.com)

**Important:** Do not assume the public OpenStreetMap tile servers are a free production map-tile hosting service. Use a suitable tile provider or self-hosted infrastructure. [OSM Foundation Operations](https://operations.osmfoundation.org/policies/tiles/?utm_source=chatgpt.com)

### 6.2 Routing Infrastructure

> **Superseded:** the 1.0.0 build uses Valhalla for distance-first routing, with an Overpass fallback when the
> routing service is unavailable. The GraphHopper plan below was not implemented.

Use a self-hosted GraphHopper instance.

Why?

- Custom routing profiles.
- Configurable route weighting.
- Support for shortest-path calculations.
- Control over routing configuration.
- Ability to work with OpenStreetMap road data.

GraphHopper documents its shortest weighting and configurable routing profiles. [GitHub](https://github.com/graphhopper/graphhopper/blob/master/docs/core/weighting.md?utm_source=chatgpt.com)

Create separate routing profiles for each transportation mode.

For the initial release, implement a two-wheeler-oriented profile with appropriately configured access and direction restrictions.

Do not simply reuse a generic car profile without validating whether its road-access assumptions are appropriate for motorcycles.

### 6.3 Backend Architecture

The mobile application communicates with the backend.

Proposed flow:

```text
       SHORT CUT MOBILE APP
                |
                |
         Backend API
          (Node.js)
                |
       -------------------
       |                 |
   GraphHopper        Supabase
   Routing Engine     PostgreSQL
       |                 |
       |             User Data
       |
   OpenStreetMap
     Road Graph
```

The routing engine should handle geographical route calculations.

The backend API should handle:

- Route requests.
- User preferences.
- Saved destinations.
- Route history.
- Shortcut reports.
- Authentication.
- Routing configuration.

Supabase should not be responsible for calculating the main route. Keep that responsibility in the dedicated routing engine.

---

# 7. Database Structure

Initial database entities:

### users

| Field | Type |
|---|---|
| id | UUID |
| email | Text |
| created_at | Timestamp |

### user_preferences

| Field | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| default_transport | Text |
| theme | Text |
| voice_navigation | Boolean |

### saved_places

| Field | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| name | Text |
| latitude | Double |
| longitude | Double |

### route_history

| Field | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| start_latitude | Double |
| start_longitude | Double |
| destination_latitude | Double |
| destination_longitude | Double |
| route_distance_meters | Integer |
| estimated_time_seconds | Integer |
| created_at | Timestamp |

### map_reports

| Field | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| report_type | Text |
| latitude | Double |
| longitude | Double |
| description | Text |
| status | Text |
| created_at | Timestamp |

Route history should have appropriate retention and privacy controls. Storing detailed location history should be optional.

---

# 8. API Requirements

Initial API endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/routes/shortest` | Find shortest route |
| POST | `/api/routes/fastest` | Find fastest alternative |
| POST | `/api/routes/alternatives` | Generate alternative routes |
| GET | `/api/places/search` | Search destinations |
| GET | `/api/places/recent` | Recent destinations |
| POST | `/api/places/saved` | Save destination |
| GET | `/api/routes/history` | Retrieve route history |
| POST | `/api/reports` | Submit map report |
| GET | `/api/navigation/status` | Retrieve navigation-related status |

### Example shortest-route request

```json
{
  "origin": {
    "latitude": 17.3850,
    "longitude": 78.4867
  },
  "destination": {
    "latitude": 17.4000,
    "longitude": 78.5000
  },
  "transport_mode": "two_wheeler",
  "optimization": "shortest_distance"
}
```

### Example response

```json
{
  "route_id": "route_123",
  "distance_meters": 1700,
  "estimated_duration_seconds": 420,
  "optimization": "shortest_distance",
  "route_confidence": "medium",
  "warnings": [],
  "geometry": {
    "type": "LineString",
    "coordinates": []
  },
  "summary": {
    "distance_saved_meters": 1100,
    "distance_saved_percentage": 39.3
  }
}
```

The coordinates array would contain the actual route geometry.

---

# 9. MVP Scope

The MVP should focus on proving one thing:

**Can Short Cut consistently discover shorter usable routes than conventional fastest-route navigation?**

### P0 — Must have

| Feature | Description |
|---|---|
| Interactive map | Map with current location |
| GPS | Current location detection |
| Destination search | Search for a destination |
| Two-wheeler mode | Initial transportation profile |
| Shortest routing | Distance-first algorithm |
| Route comparison | Shortest vs fastest |
| Route visualization | Display selected route |
| Distance savings | Show distance saved |
| Basic navigation | Follow calculated route |
| Rerouting | Recalculate after deviation |
| Road restrictions | Enforce applicable restrictions |

### P1 — Should have

- Voice navigation.
- Walking mode.
- Saved destinations.
- Recent searches.
- Route preferences.
- Better road-surface information.
- Improved rerouting.
- Route confidence indicators.

### P2 — Future features

- Community shortcut discovery.
- Crowdsourced road corrections.
- Offline maps.
- Live traffic information.
- Bicycle navigation.
- Car navigation.
- Delivery-oriented route statistics.
- Advanced route analytics.

### Explicitly out of scope for MVP

- Food delivery management.
- Order management.
- Payment processing.
- Social networking.
- Public user profiles.
- AI chatbot.
- Full Google Maps business listing replacement.

Keep the first release focused.

---

# 10. Safety and Reliability Requirements

This section is particularly important because Short Cut is designed around aggressive distance optimization.

The application must distinguish between:

**Shorter route:** A route with less total distance.

**Usable route:** A route that the selected vehicle or pedestrian can legally and physically travel.

Both conditions must be evaluated.

Requirements:

1. Do not route motor vehicles against mapped one-way restrictions.
2. Respect known road closures and access restrictions.
3. Avoid private or restricted properties.
4. Do not instruct users to cross railway tracks or enter prohibited areas.
5. Clearly identify uncertain map data.
6. Display known rough surfaces and relevant road warnings.
7. Provide a way to report incorrect road information.
8. Never describe an unverified route as guaranteed safe.

The product must also account for inaccurate road data. A route engine cannot enforce restrictions that its underlying data does not contain.

---

# 11. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Route results should ideally load within 3 seconds for normal queries |
| GPS | Location updates should be suitable for live navigation |
| Reliability | Failed route requests should provide useful error messages |
| Scalability | Backend should support multiple concurrent users |
| Privacy | Location collection should be minimized |
| Security | Authenticated APIs and protected secrets |
| Battery | GPS updates should be optimized |
| Availability | Routing service should have health monitoring |
| Compatibility | Android-first, with future iOS support |

The three-second routing target is an initial engineering goal, not a guaranteed performance figure. It must be tested with real Hyderabad map data and infrastructure.

---

# 12. Product Success Metrics

We need to measure whether Short Cut actually delivers its promise.

### Primary metric

**Average distance saved per completed journey.**

Example:

If the conventional fastest alternative is 3 km and Short Cut finds a usable route of 2 km:

Distance saved = 1 km.

### Secondary metrics

| Metric | Purpose |
|---|---|
| Average distance saved | Measures product value |
| Shortest-route success rate | Measures routing effectiveness |
| Route calculation time | Measures performance |
| Rerouting success rate | Measures navigation reliability |
| Navigation completion rate | Measures usability |
| GPS accuracy | Measures location quality |
| Route abandonment rate | Identifies poor route experiences |
| Map issue reports | Measures data quality |

### Initial product targets

These are proposed targets to validate, not existing performance claims.

- 90% of normal route requests return within 3 seconds.
- 95% of route requests return a connected route when a valid mapped path exists.
- Route calculations consistently minimize distance within their permitted network.
- Users can start navigation without requiring a complicated setup.
- Users report measurable distance savings in the pilot area.

---

# 13. Development Roadmap

I recommend breaking development into six phases.

| Phase | Work | Deliverable |
|---|---|---|
| 1 | Map integration | Interactive Hyderabad map |
| 2 | GPS and search | Origin and destination selection |
| 3 | Routing engine | Shortest-distance calculations |
| 4 | Route comparison | Shortest vs fastest routes |
| 5 | Navigation | GPS tracking and rerouting |
| 6 | Testing and optimization | Android MVP |

### Phase 1: Map Foundation

- Create Expo React Native project.
- Configure MapLibre.
- Integrate map tiles.
- Display GPS position.
- Implement map interactions.

### Phase 2: Location System

- Request location permissions.
- Implement GPS tracking.
- Implement destination selection.
- Integrate geocoding.

### Phase 3: Routing Engine

- Deploy GraphHopper.
- Import Hyderabad OpenStreetMap data.
- Configure a two-wheeler profile.
- Implement shortest-distance weighting.
- Verify that direction and access restrictions work.
- Test different routes throughout Hyderabad.

### Phase 4: Route Comparison

- Calculate shortest route.
- Calculate fastest alternative.
- Display both routes.
- Display distance and ETA.
- Calculate potential distance savings.

### Phase 5: Navigation

- Implement live route tracking.
- Detect route deviations.
- Recalculate routes.
- Implement the navigation interface.

### Phase 6: Testing

Conduct real-world testing in different parts of Hyderabad.

Test:

- Narrow residential streets.
- Busy main roads.
- Complex intersections.
- One-way roads.
- Poorly mapped neighborhoods.
- Missing road connections.
- Different GPS conditions.

Compare the actual route distance against conventional navigation alternatives.

---

# 14. Biggest Technical Challenges

These are the problems I would pay particular attention to.

### Challenge 1: Map data completeness

OpenStreetMap may not contain every small lane or connecting road.

**Solution:** Test local coverage, collect map corrections, and progressively improve map data.

### Challenge 2: The routing engine may still favor longer roads

Simply installing a routing engine does not guarantee shortest-distance routing.

**Solution:** Configure a dedicated shortest-distance weighting and independently validate its output.

### Challenge 3: Two-wheeler access restrictions

Not every road accessible to a car is necessarily appropriate for a motorcycle, and vice versa.

**Solution:** Develop a dedicated two-wheeler profile with carefully validated access and direction rules.

### Challenge 4: GPS inaccuracies

GPS inaccuracies can make the application believe users have departed from their route.

**Solution:** Implement GPS filtering, snapping, and deviation thresholds.

### Challenge 5: Map infrastructure costs

Map rendering, geocoding, routing, and hosting have separate infrastructure requirements.

**Solution:** Begin with a small Hyderabad map extract and a self-hosted routing engine. Use a map-tile provider with suitable production terms.

---

# 15. Final Product Definition

Short Cut is not intended to become another application that simply displays a map and offers directions.

Its central functionality is different.

It should continually ask:

**"What is the shortest usable path between these two locations?"**

Everything else supports that objective.

Its competitive advantage should eventually come from three areas:

1. A routing engine specifically optimized for distance.
2. Better discovery of smaller connecting roads and public passages.
3. Improving local map data through community contributions.

The strongest long-term opportunity is the third one.

As more users travel through the city and report missing connections, Short Cut can progressively improve the underlying road network.

---

# Part 3: My Final Product Recommendations

There are five decisions I'd make before writing the first line of code.

| Decision | My recommendation |
|---|---|
| Initial platform | Android |
| Launch location | Hyderabad |
| Primary audience | Delivery riders |
| Initial transport mode | Two-wheelers |
| Routing engine | GraphHopper |
| Map renderer | MapLibre |
| Map data | OpenStreetMap |
| Backend | Node.js + Supabase |
| Primary objective | Minimum traversable distance |

### One feature I'd prioritize above everything else

**Shortest vs Fastest Comparison.**

Imagine someone searches for a destination.

Instead of just displaying a route, Short Cut immediately shows:

╭──────────────────────────────╮  
│        SHORT CUT ROUTE       │  
│                              │  
│           1.7 KM             │  
│          7 MINUTES           │  
│                              │  
│     YOU SAVE 1.1 KM          │  
│                              │  
│      [ START NAVIGATION ]    │  
│                              │  
│     Fastest alternative:    │  
│          2.8 KM              │  
╰──────────────────────────────╯

That's the moment when the user understands why Short Cut exists.

---

# Part 4: Important Research References

These are the official technical resources I'd use when implementing the product:

| Resource | Purpose |
|---|---|
| [GraphHopper Documentation](https://docs.graphhopper.com/?utm_source=chatgpt.com) | Routing engine and customization |
| [GraphHopper Source Code](https://github.com/graphhopper/graphhopper?utm_source=chatgpt.com) | Routing implementation |
| [MapLibre React Native](https://maplibre.org/maplibre-react-native/?utm_source=chatgpt.com) | Mobile map rendering |
| [OpenStreetMap](https://www.openstreetmap.org/?utm_source=chatgpt.com) | Geographical data |
| [OpenStreetMap Tile Policy](https://operations.osmfoundation.org/policies/tiles/?utm_source=chatgpt.com) | Production map-tile requirements |
| [Supabase Documentation](https://supabase.com/docs?utm_source=chatgpt.com) | Database and authentication |

---

## My verdict

I genuinely think the interesting part of Short Cut isn't simply calculating shorter routes.

It's **finding connections that conventional navigation might overlook**.

I'd resist turning this into a massive navigation application initially. Get the shortest-distance algorithm working, test it around Hyderabad, and see how often it discovers meaningful distance savings.

The first real milestone should be:

**Give Short Cut two GPS coordinates in Hyderabad and make it return the shortest permitted two-wheeler route between them.**

Everything else can build on that.