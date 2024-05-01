class MissionManager {
    constructor(viewer, MModeController, alertManager, thumbnailName, generalManager, number, id) {
        this.viewer = viewer
        this.generalManager = generalManager
        this.number = number
        this.id = id
        this.MModeController = MModeController
        this.alertManager = alertManager
        this.thumbnailName = thumbnailName.split('/')[1]
        this.dataSource = new Cesium.CustomDataSource(id ?? '')
        this.missionItems = []
        this.selectedPointId = -1
        this.nextPointIndex = 0
        this.managerLocked = false

        const menuColorScheme = this.initColorScheme()

        this.missionHealthy = true
        this.hasLaunchPoint = false
        this.hasLandPoint = false
        this.aircraftType = 'copter'
        this.sumDistance = 0
        this.sumDuration = 0
        this.speedLimit = 15
        this.altLimit = 10000
        this.delayLimit = 300
        this.homeOriginLat = undefined
        this.homeOriginLon = undefined
        this.initDefaults()
        this.setupDefaultCallbacks(this)

        this.domManager = new DomMissionManager(this, menuColorScheme)
        this.domManager.createMissionMenu()

        this.viewer.dataSources.add(this.dataSource)
    }

    initDefaults() {
        this.defaultSpeed = MissionItem.defaultSpeed
        this.defaultFrame = MissionItem.defaultFrame
        this.defaultHeading = MissionItem.defaultHeading
        this.defaultTerrainAlt = MissionItem.defaultTerrainAlt
        this.defaultWPRadius = MissionItem.defaultWPRadius
    }

    initColorScheme() {
        let menuColorScheme = undefined
        if (this.generalManager) {
            this.colorScheme = {
                main: COLOR_SCHEMES[COLOR_COUNTER].default,
                roi: COLOR_SCHEMES[COLOR_COUNTER].roi,
            }

            menuColorScheme = COLOR_SCHEMES[COLOR_COUNTER].default.main.withAlpha(0.75).darken(0.5, new Cesium.Color()).toCssColorString()
            COLOR_COUNTER >= 9
                ? COLOR_COUNTER = 0
                : COLOR_COUNTER ++
        } else {
            this.colorScheme = {
                main: COLOR_SCHEMES[0].default,
                roi: COLOR_SCHEMES[0].roi,
            }
        }

        return menuColorScheme
    }

    setupDefaultCallbacks(manager) {
        function pointColorCondition(active, passive, hidden, obj) {
            if (manager.generalManager?.editingMission === manager.id ||
                manager.generalManager?.currentOpenMenu === manager.id) {
                if (manager.selectedPointId === obj.seq ||
                    manager.selectedPointId === obj.roiPoint?.seq) {
                        return active
                } else {
                    return passive
                }
            } else if (manager.generalManager &&
                       manager.generalManager?.editingMission === undefined &&
                       manager.generalManager?.currentOpenMenu === undefined) {
                return passive
            } else {
                return hidden
            }
        }
        this.defaultCallbacks = {
            point: {
                ground: {
                    main: (obj) => new Cesium.CallbackProperty(function () {
                        return pointColorCondition(
                            this.itemColorScheme.groundPoint.active,
                            this.itemColorScheme.groundPoint.passive,
                            Cesium.Color.fromAlpha(this.itemColorScheme.groundPoint.passive, 0.07),
                            this
                        )
                    }.bind(obj)),
                    outline: (obj) => new Cesium.CallbackProperty(function () {
                        return pointColorCondition(
                            this.itemColorScheme.outlineActive,
                            this.itemColorScheme.main,
                            Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2),
                            this
                        )
                    }.bind(obj)),
                },
                nav: {
                    main: (obj) => new Cesium.CallbackProperty(function () {
                        if (!this.itemHealthy) {
                            if (manager.selectedPointId === obj.seq ||
                                manager.selectedPointId === obj.roiPoint?.seq)
                                return Cesium.Color.fromCssColorString('#f44336')
                            else
                                return Cesium.Color.fromCssColorString('#d32f2f')
                        }

                        return pointColorCondition(
                            this.itemColorScheme.pointActive,
                            this.itemColorScheme.main,
                            Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2),
                            this
                        )
                    }.bind(obj)),
                    outline: (obj) => new Cesium.CallbackProperty(function () {
                        return pointColorCondition(
                            this.itemColorScheme.outlineActive,
                            this.itemColorScheme.main,
                            Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2),
                            this
                        )
                    }.bind(obj)),
                }
            },
            text: {
                fill: (obj) => new Cesium.CallbackProperty(function () {
                    return pointColorCondition(
                        this.itemColorScheme.text.active,
                        this.itemColorScheme.text.passive,
                        Cesium.Color.fromAlpha(this.itemColorScheme.text.passive, 0.2),
                        this
                    )
                }.bind(obj)),
                background: (obj) => new Cesium.CallbackProperty(function () {
                    if (!this.itemHealthy) {
                        if (manager.selectedPointId === obj.seq ||
                            manager.selectedPointId === obj.roiPoint?.seq)
                            return Cesium.Color.fromCssColorString('#f44336')
                        else
                            return Cesium.Color.fromCssColorString('#d32f2f')
                    }

                    return pointColorCondition(
                        this.itemColorScheme.pointActive,
                        this.itemColorScheme.main,
                        Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2),
                        this
                    )
                }.bind(obj)),
            },
            polylineMaterialColor: (obj) => new Cesium.PolylineOutlineMaterialProperty({
                color: new Cesium.CallbackProperty(function () {
                    if (!manager.generalManager) {
                        return this.itemColorScheme.main
                    } else if (manager.generalManager?.editingMission === manager.id ||
                               manager.generalManager?.currentOpenMenu === manager.id) {
                        return this.itemColorScheme.main
                    } else if (manager.generalManager &&
                        manager.generalManager?.editingMission === undefined &&
                        manager.generalManager?.currentOpenMenu === undefined) {
                        return this.itemColorScheme.main
                    } else {
                        return Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2)
                    }
                }.bind(obj)),
                outlineWidth: 0
            }),
            mainMaterialColor: (obj) => new Cesium.ColorMaterialProperty(
                new Cesium.CallbackProperty(function () {
                    if (!manager.generalManager) {
                        return this.itemColorScheme.main
                    } else if (manager.generalManager?.editingMission === manager.id ||
                               manager.generalManager?.currentOpenMenu === manager.id) {
                        return this.itemColorScheme.main
                    } else if (manager.generalManager?.editingMission === undefined &&
                               manager.generalManager?.currentOpenMenu === undefined) {
                        return this.itemColorScheme.main
                    } else {
                        return Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2)
                    }
                }.bind(obj)),
            ),
            mainColor: (obj) => new Cesium.CallbackProperty(function () {
                if (!manager.generalManager) {
                    return this.itemColorScheme.main
                } else if (manager.generalManager?.editingMission === manager.id ||
                           manager.generalManager?.currentOpenMenu === manager.id) {
                    return this.itemColorScheme.main
                } else if (manager.generalManager &&
                           manager.generalManager?.editingMission === undefined &&
                           manager.generalManager?.currentOpenMenu === undefined) {
                    return this.itemColorScheme.main
                } else {
                    return Cesium.Color.fromAlpha(this.itemColorScheme.main, 0.2)
                }
            }.bind(obj)),
        }
    }

    updateSeqIndexes(fromIndex) {
        fromIndex = Math.max(0, fromIndex)
        for (let i = fromIndex; i < this.missionItems.length; i++) {
            this.missionItems[i].updateItemSeq(i)
            this.domManager.updateItemId(i)
        }
    }

    updateConnectedPoints(itemId) {
        const navItem = this.missionItems[itemId]
        if (navItem) {
            navItem.updateConnectedPoints()
        }
    }

    updateConnectedToNextNavItem(currentIndex, nextNavItemId) {
        if (nextNavItemId === undefined)
            nextNavItemId = this.missionItems.length
        this.missionItems.slice(currentIndex, nextNavItemId).map((missionItem) => {
            missionItem.updateConnectedPoints()
        })
    }

    addPoint(pointType, lat, lon, triggerPointId) {
        let item = undefined
        let newPointId = this.nextPointIndex

        switch(pointType) {
            case 'simple':
                // Simple cesium map clicking
                if (this.hasLandPoint) {
                    return
                }

                if (newPointId > 0) {
                    item = new WaypointItem({
                        coordinates: [lat, lon, this.defaultTerrainAlt],
                        frame: this.defaultFrame,
                        seq: newPointId,
                        manager: this})
                } else {
                    if (this.aircraftType === 'copter') {
                        item = new LaunchItem({
                            coordinates: [lat, lon, this.defaultTerrainAlt],
                            frame: this.defaultFrame,
                            seq: newPointId,
                            manager: this
                        })
                    } else {
                        item = new VtolTakeoff({
                            coordinates: [lat, lon, this.defaultTerrainAlt],
                            frame: this.defaultFrame,
                            seq: newPointId,
                            manager: this
                        })
                    }
                    this.hasLaunchPoint = true
                    if (!this.missionItems.length) {
                        this.viewer.camera.flyTo({
                            destination: Cesium.Cartesian3.fromDegrees(lon, lat, item.terrainAlt + 1000),
                            duration: 0,
                        })
                    }
                }
                break
            case 'middleWaypoint':
                if (triggerPointId === undefined)
                    return
                const prevItem = this.missionItems[triggerPointId]
                const fractionResult = prevItem.getFractionPositionToNextPoint()
                const newPose = Cesium.Cartographic.fromCartesian(fractionResult.point)
                newPointId = prevItem.nextPoint.seq
                item = new WaypointItem({
                    coordinates: [
                        Cesium.Math.toDegrees(newPose.latitude),
                        Cesium.Math.toDegrees(newPose.longitude),
                        this.defaultTerrainAlt
                    ],
                    frame: this.defaultFrame,
                    seq: newPointId,
                    manager: this})
                break
            case 'roi':
                item = new ROIItem({
                    coordinates: [lat, lon, this.defaultTerrainAlt],
                    frame: this.defaultFrame,
                    seq: newPointId,
                    manager: this})
                break
            default:
                return // TODO hint
            }

        if (this.missionItems.length == 0)
            this.domManager.openForm(true)

        const defaultItem = this.domManager.addPoint(item.pointName, newPointId, this)
        item.setupDomItem(defaultItem)

        if (this.managerLocked)
            this.domManager.lockItem(newPointId, true)

        this.missionItems.splice(newPointId, 0, item)
        this.updateSeqIndexes(newPointId)

        const roiIndex = this.getPreviousActiveRoiIndex(newPointId)
        if (roiIndex != null)
            item.roiPoint = this.missionItems[roiIndex]

        this.updateConnectedPoints(newPointId)

        if (newPointId === 0) {
            this.updateHomeAndLocationForZero()
        }

        this.setupDomItem(defaultItem)

        this.updateDistanceAndDuration()

        this.domManager.setItemsCount(this.missionItems.length)

        this.nextPointIndex += 1
    }

    changeItemType(itemId, newType) {
        let newItem = undefined
        let prevItem = undefined
        console.log('change item', newType)
        switch(newType) {
            case 'launch':
                if (!this.hasLaunchPoint) {
                    prevItem = this.removePoint(itemId)
                    if (prevItem.lat && prevItem.lon) {
                        newItem = new LaunchItem({
                            coordinates: [prevItem.lat, prevItem.lon, this.defaultTerrainAlt],
                            seq: this.nextPointIndex,
                            manager: this
                        })
                        this.hasLaunchPoint = true
                    }
                } else {
                    // TODO hint
                }
                break
            case 'waypoint':
                prevItem = this.removePoint(itemId)
                if (prevItem.lat && prevItem.lon) {
                    newItem = new WaypointItem({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new WaypointItem({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                break
            case 'loiter':
                prevItem = this.removePoint(itemId)
                if (prevItem.lat && prevItem.lon) {
                    newItem = new LoiterItem({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new LoiterItem({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                break
            case 'roiLocation':
                prevItem = this.removePoint(itemId)
                if (prevItem.lat && prevItem.lon) {
                    newItem = new ROILocationItem({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new ROILocationItem({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                break
            case 'roiDisable':
                this.removePoint(itemId)
                newItem = new ROIDisableItem({seq: itemId, manager: this})
                break
            case 'rtl':
                break
            case 'land':
                prevItem = this.removePoint(itemId)
                if (prevItem.lat && prevItem.lon) {
                    newItem = new LandItem({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new LandItem({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                this.domManager.controlItemsOptions(['land', 'vtolLand'], false)
                this.hasLandPoint = true
                break
            case 'changeSpeed':
                this.removePoint(itemId)
                newItem = new ChangeSpeedItem({seq: itemId, manager: this})
                break
            case 'delay':
                this.removePoint(itemId)
                newItem = new DelayItem({seq: itemId, manager: this})
                break
            case 'jump':
                this.removePoint(itemId)
                newItem = new JumpItem({seq: itemId, manager: this})
                break
            case 'startVideoCapture':
                break
            case 'stopVideoCapture':
                break
            case 'startImageCapture':
                break
            case 'stopImageCapture':
                break
            case 'cameraConfig':
                break
            case 'vtolTransition':
                this.removePoint(itemId)
                newItem = new VtolTransition({seq: itemId, manager: this})
                break
            case 'vtolTakeoff':
                prevItem = this.removePoint(itemId)
                this.hasLaunchPoint = true
                if (prevItem.lat && prevItem.lon) {
                    newItem = new VtolTakeoff({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new VtolTakeoff({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                this.hasLaunchPoint = true
                break
            case 'vtolLand':
                prevItem = this.removePoint(itemId)
                if (prevItem.lat && prevItem.lon) {
                    newItem = new VtolLand({
                        coordinates: [prevItem.lat, prevItem.lon, prevItem.terrainAltOffset],
                        seq: itemId,
                        manager: this
                    })
                } else {
                    const newPose = this.getNewItemLocation(itemId)
                    newItem = new VtolLand({
                        coordinates: [newPose.lat, newPose.lon, this.defaultTerrainAlt],
                        seq: itemId,
                        manager: this
                    })
                }
                break
        }
        if (newItem) {
            const defaultItem = this.domManager.addPoint(newItem.pointName, itemId, this)
            newItem.setupDomItem(defaultItem)

            this.missionItems.splice(itemId, 0, newItem)

            this.updateSeqIndexes(itemId - 1)

            if (CesiumMissionNavItem.pointIsNav(newItem)) {
                const roiIndex = this.getPreviousActiveRoiIndex(itemId)
                if (roiIndex != null)
                    newItem.roiPoint = this.missionItems[roiIndex]
            }

            const nextNavItemId = this.getNextCesiumNavPointIndex(itemId + 1)
            this.updateConnectedToNextNavItem(itemId, nextNavItemId)

            this.domManager.selectItem(itemId)

            if (itemId === 0) {
                this.updateHomeAndLocationForZero()
            }

            if (prevItem instanceof LandItem)
                this.hasLandPoint = false

            if (newItem instanceof ROILocationItem || newItem instanceof ROIDisableItem ||
                prevItem instanceof ROILocationItem || prevItem instanceof ROIDisableItem)
                this.updateRoiConnected(itemId)

            this.setupDomItem(defaultItem)

            this.nextPointIndex += 1
        }
        this.domManager.setItemsCount(this.missionItems.length)
        this.missionItemsHealthyCheck()
    }

    removePoint(pointId) {
        const item = this.missionItems[pointId]
        if (item) {
            this.missionItems.splice(pointId, 1)
            this.domManager.removeItem(pointId)
            this.updateSeqIndexes(pointId)
            item.removeCesiumEntity()
            this.nextPointIndex -= 1
            this.selectedPointId = -1
            this.domManager.selectItem(undefined)
            this.domManager.setItemsCount(this.missionItems.length)
            this.missionItemsHealthyCheck()

            if (item instanceof LaunchItem || item instanceof VtolTakeoff) {
                this.hasLaunchPoint = false  // TODO html home hints
            } else {
                if (item instanceof LandItem) {
                    this.hasLandPoint = false
                    this.domManager.controlItemsOptions(this.getActiveCommands('land'), true)
                } else if (item instanceof ROILocationItem || item instanceof ROIDisableItem) {
                    this.updateRoiConnected(pointId - 1)
                }

                const prevNavPointId = this.getPreviousCesiumNavPointIndex(pointId - 1)
                if (prevNavPointId !== undefined)
                    this.missionItems[prevNavPointId].updateConnectedPoints()

                const nextNavItemId = this.getNextCesiumNavPointIndex(pointId)
                this.updateConnectedToNextNavItem(pointId, nextNavItemId)
            }

            if (pointId === 0) {
                this.updateHomeAndLocationForZero()
            }
            this.updateDistanceAndDuration()
            return item
        }
    }

    setupDomItem(element) {
        if (this.hasLandPoint)
            this.domManager.controlItemOptions(element, ['land', 'vtolLand'], false)
        if (this.aircraftType === 'copter')
            this.domManager.controlItemOptions(element, this.getActiveCommands('vtol'), false)
    }

    getNextCesiumNavPointIndex(currentIndex) {
        for (let ind = currentIndex; ind < this.missionItems.length; ind++) {
            if (CesiumMissionNavItem.pointIsNav(this.missionItems[ind])) {
                return ind
            }
        }
    }

    getPreviousCesiumNavPointIndex(currentIndex) {
        for (let ind = currentIndex; ind >= 0; ind--) {
            if (CesiumMissionNavItem.pointIsNav(this.missionItems[ind])) {
                return ind
            }
        }
    }

    getNextActiveRoiIndex(currentIndex) {
        for (let ind = currentIndex; ind < this.missionItems.length; ind++) {
            if (this.missionItems[ind] instanceof ROILocationItem)
                return ind
        }
        return null
    }

    getPreviousActiveRoiIndex(currentIndex) {
        for (let ind = currentIndex; ind >= 0; ind--) {
            if (this.missionItems[ind] instanceof ROILocationItem)
                return ind
        }
        return null
    }

    getPreviousCommandsCount(currentIndex, lastNavPoint) {
        let count = 0
        for (let ind = currentIndex; ind >= lastNavPoint; ind--) {
            if (this.missionItems[ind] instanceof CesiumMissionControlItem) {
                count += 1
            }
        }
        return count
    }

    getNewItemLocation(itemId) {
        let newPose = this.getLocationBetweenPrevAndNext(itemId)
        if (!newPose)
            newPose = this.getLocationNearPrevNavItem(itemId) // TODO If no nav points on map
            if (!newPose)
                return // TODO raise error
        return newPose
    }

    getLocationBetweenPrevAndNext(itemId, fraction=0.5) {
        const prevNavItemId = this.getPreviousCesiumNavPointIndex(itemId - 1)
        const nextNavItemId = this.getNextCesiumNavPointIndex(itemId)

        if (nextNavItemId === undefined)
            return

        const startItem = this.missionItems[prevNavItemId]
        const endItem = this.missionItems[nextNavItemId]

        const startCartesian = Cesium.Cartesian3.fromDegrees(startItem.lon, startItem.lat)
        const endCartesian = Cesium.Cartesian3.fromDegrees(endItem.lon, endItem.lat)

        const result = CesiumMissionItem.lineFraction(startCartesian, endCartesian, fraction)
        const resultPoint = Cesium.Cartographic.fromCartesian(result.point)
        return {
            lat: Cesium.Math.toDegrees(resultPoint.latitude),
            lon: Cesium.Math.toDegrees(resultPoint.longitude)
        }
    }

    getLocationNearPrevNavItem(itemId) {
        const rad = 0.0005
        const randAngle = (Math.random() * Math.PI * 2)

        const prevNavItemId = this.getPreviousCesiumNavPointIndex(itemId)
        if (prevNavItemId == undefined)
            return

        const result = {
            lat: this.missionItems[prevNavItemId].lat + Math.cos(randAngle) * rad,
            lon: this.missionItems[prevNavItemId].lon + Math.sin(randAngle) * rad,
        }
        return result
    }

    updateRoiConnected(triggerId) {
        const previousActiveRoiIndex = this.getPreviousActiveRoiIndex(triggerId)
        let disableRoiIndex = 0

        if (previousActiveRoiIndex !== null){
            let prevNavItemBeforeRoi = this.getPreviousCesiumNavPointIndex(previousActiveRoiIndex - 1)

            const disablers = this.missionItems
                .slice(previousActiveRoiIndex + 1, this.missionItems.length - 1)
                .filter(item => item instanceof ROIDisableItem || item instanceof ROILocationItem)
            disableRoiIndex = disablers[0] === undefined
                ? this.missionItems.length
                : this.getPreviousCesiumNavPointIndex(disablers[0].seq - 1)

            this.missionItems
                .slice(prevNavItemBeforeRoi, disableRoiIndex)
                .filter(item => CesiumMissionNavItem.pointIsNav(item))
                .map((navItem => navItem.roiPoint = this.missionItems[previousActiveRoiIndex]))
        }

        let lastNavItemWithoutRoiIndex = this.missionItems.length
        let nextActiveRoiIndex = this.getNextActiveRoiIndex(triggerId)
        if (disableRoiIndex != 0) {
            nextActiveRoiIndex = this.getNextActiveRoiIndex(disableRoiIndex)
        }

        if (nextActiveRoiIndex !== null) {
            lastNavItemWithoutRoiIndex = this.getPreviousCesiumNavPointIndex(nextActiveRoiIndex - 1)
        }

        this.missionItems
            .slice(disableRoiIndex, lastNavItemWithoutRoiIndex)
            .filter(item => CesiumMissionNavItem.pointIsNav(item))
            .map((navItem => navItem.roiPoint = undefined))
    }

    updateHomeAndLocationForZero() {
        const nextNavPointIndex = this.getNextCesiumNavPointIndex(0)
        if (this.missionItems[nextNavPointIndex]) {
            const missionItem = this.missionItems[nextNavPointIndex]
            missionItem.updateConnectedPoints()
            this.domManager.setLaunchLatLon(missionItem.lat, missionItem.lon)
            this.updateHomeAdress()
        } else {
            this.domManager.setLaunchLatLon(undefined, undefined)
            this.domManager.setHomeAddress(undefined)
        }
    }

    updateTakeoffPosition(droneLat, droneLon) {
        if (!this.missionItems[0] || !this.missionItems[0] instanceof LaunchItem)
            return

        const takeoffItem = this.missionItems[0]
        if (droneLat != takeoffItem.lat && droneLon != takeoffItem.lon) {
            this.homeOriginLat = takeoffItem.lat
            this.homeOriginLon = takeoffItem.lon
            let takeoffCartog = Cesium.Cartographic.fromDegrees(droneLon, droneLat)
            //takeoffCartog.height = height
            this.updateGroundPosition(0, takeoffCartog)
            this.endMoveGroundPosition(0)
        }
    }

    updateGroundPosition(pointId, cartographicPosition) {
        if(cartographicPosition.longitude && cartographicPosition.latitude) {  // TODO check if object exist
            this.missionItems[pointId].updateGroundPosition(cartographicPosition)

            this.updateLandAlt()
            this.updateDistanceAndDuration()
        }
    }

    endMoveGroundPosition(pointId) {
        this.missionItems[pointId].updateTerrainHeight(this.missionItems[pointId])
    }

    getGroundPosition(pointId) {
        const item = this.missionItems[pointId]
        return {lat: item.lat, lon: item.lon}
    }

    updateAltPosition(pointId, offset) {
        if (offset) {
            this.missionItems[pointId].updateAltPosition(offset)
        }
        this.updateLandAlt()
        this.updateDistanceAndDuration()
    }

    updateLoiterRadiusDelta(pointId, radiusDelta) {
        if (radiusDelta) {
            this.missionItems[pointId].updateRadiusDelta(radiusDelta)
        }
    }

    changeLoiterDirection(pointId) {
        this.missionItems[pointId].radius *= -1
    }

    changeLoiterClockwise(pointId) {
        this.missionItems[pointId].changeClockwise()
    }

    changeAircraftType(type) {
        this.aircraftType = type
        const vtolEnable = this.aircraftType === 'vtol' ? true : false

        const vtolCommnads = this.getActiveCommands('vtol')

        this.domManager.controlItemsOptions(vtolCommnads, vtolEnable)
        for (let missionItem of this.missionItems) {
            if (missionItem.vtolEntities !== undefined) {
                for (let vtolEntity of missionItem.vtolEntities) {
                    vtolEntity.show = vtolEnable
                }
            }
        }
    }

    getActiveCommands(type) {
        const commands = []
        switch (type) {
            case 'land':
                commands.push('land')
                if (this.aircraftType === 'vtol')
                    commands.push('vtolLand')
                break
            case 'vtol':
                commands.push('vtolTransition', 'vtolTakeoff')
                if (!this.hasLandPoint)
                    commands.push('vtolLand')
                break
        }
        return commands
    }

    getAltPosition(pointId) {
        const item = this.missionItems[pointId]

        return [item.terrainAltOffset, item.terrainAlt]
    }

    updateLandAlt() {
        if (this.hasLandPoint) {
            this.missionItems[this.missionItems.length-1].updateAltPosition()
        }
    }

    updateHomeAdress() {
        const inst = this
        const nextNavPointIndex = this.getNextCesiumNavPointIndex(0)
        const nextPoint = this.missionItems[nextNavPointIndex]

        if (nextPoint) {
            gmap_getLocations({lat: nextPoint.lat, lng: nextPoint.lon})
                .then(function (result) {
                    if (inst.getNextCesiumNavPointIndex(0) !== undefined)
                        inst.domManager.setHomeAddress(result.fullName)
                })
        } else {
            this.domManager.setHomeAddress(undefined)
        }
    }

    updateDistanceAndDuration() {
        let distance = 0
        let duration = 0
        let prevDistance = 0

        let speed = this.defaultSpeed

        for (let missionItem of this.missionItems) {
            if (missionItem instanceof ChangeSpeedItem)
                speed = missionItem.speed
            else if (missionItem instanceof LaunchItem ||
                     missionItem instanceof LandItem) {
                distance += missionItem.terrainAltOffset
                duration += missionItem.terrainAltOffset / speed
            }

            if (missionItem.distance) {
                if (prevDistance === undefined) {
                    prevDistance = missionItem.distance
                    continue
                }

                duration += prevDistance / speed
                distance += prevDistance
                prevDistance = missionItem.distance
            }
        }
        distance += prevDistance
        duration += prevDistance / speed

        this.sumDistance = distance
        this.sumDuration = duration
        this.domManager.setDistanceAndDuration(
            isNaN(distance) ? 0 : distance, isNaN(duration) ? 0 : duration)
    }

    applyDefaultAlt() {
        for (let missionItem of this.missionItems) {
            if (missionItem.updateAltPosition)
                missionItem.updateAltPosition(this.defaultTerrainAlt)
        }
    }
    
    applyDefaultSpeed() {
        for (let missionItem of this.missionItems) {
            if (missionItem.updateSpeed)
                missionItem.updateSpeed(this.defaultSpeed)
        }
    }

    selectDomItem(except) {
        console.log('select item', this.missionItems[except])
        this.domManager.selectItem(except)
    }

    setFocusedItemName(name) {
        MissionManager.selectedPointIndex = name
    }

    changeColorScheme(newColorScheme) {
        this.colorScheme = newColorScheme
    }

    cleanMission() {
        for (let itemIndex = this.missionItems.length - 1; itemIndex >= 0; itemIndex--) {
            this.removePoint(itemIndex)
        }
    }

    deleteMission() {
        //this.viewer.dataSources.remove(this.dataSource, false)
        this.dataSource.entities.removeAll()
        this.domManager.deleteMenu()
    }

    showMission(show) {
        this.dataSource.show = show
        const hideButton = this.domManager.missionMenu.find('.hide-mission').closest('div')
        show ? hideButton.removeClass('mission-hiden') : hideButton.addClass('mission-hiden')
    }

    isHidden() {
        return this.domManager.missionMenu.find('.hide-mission').closest('div').hasClass('mission-hiden')
    }

    // Get json mission for cloud
    getJsonMission() {
        const defaults = {
            aircraftType: this.aircraftType,
            defaultTerrainAlt: this.defaultTerrainAlt,
            defaultHeading: this.defaultHeading,
            defaultSpeed: this.defaultSpeed,
            defaultFrame: this.defaultFrame,
        }

        let items = []
        for (let missionItem of this.missionItems) {
            items.push(missionItem.getDjangoJsonItem())
        }

        const mission = {
            version: 2,
            defaults: defaults,
            items: items,
            location: this.domManager.location,  // TODO rename to location and in django as well
        }
        return JSON.stringify(mission)
    }

    // Mission load from cloud
    loadJsonMission(jsonMission, missionName) {
        let loadedMission = jsonMission
        if (typeof jsonMission === 'string')
            loadedMission = JSON.parse(jsonMission)
        let missionItems

        if (loadedMission.version === 1) {
            missionItems = this.prepareV1MissionItems(loadedMission)
        } else if (loadedMission.version === 2) {
            this.loadMissionDefaults(loadedMission.defaults)
            missionItems = loadedMission.items
        }
        this.loadMissionItems(missionItems)
        this.domManager.name = missionName
        setTimeout(() => {
            // fix for simultaneous transition when adding a form
            this.domManager.openForm(true)
        }, 0)

        let flyLat = 0
        let flyLon = 0
        let maxDist = 0
        let navItems = 0
        for (let item of this.missionItems) {
            if (item.lat && item.lon) {
                flyLat += item.lat ?? flyLat
                flyLon += item.lon ?? flyLat
                maxDist = Math.max(item.distance ?? 0, maxDist)
                navItems ++
            }
        }
        if (isNaN(maxDist) || maxDist === 0)
            maxDist = 1000

        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                flyLon / navItems,
                flyLat / navItems,
                maxDist * 2.5
            ),
            duration: 1.5,
        });
    }

    prepareV1MissionItems(loadedMission) {
        let convertedMission = []

        const takeoffCoords = loadedMission.home.coordinate
        takeoffCoords.push(this.defaultTerrainAlt)
        convertedMission.push(
            {
                pointName: 'takeoff',
                coordinates: takeoffCoords,
                frame: 3
            }
        )

        let itemId = 0
        for (let loadedItem of loadedMission.actions) {
            if (loadedItem.command != 'Waypoint') {
                itemId ++
                continue
            }

            let itemCoordinate = loadedItem.coordinate
            itemCoordinate[2] = loadedItem.elevation
            convertedMission.push(
                {
                    pointName: 'waypoint',
                    coordinates: itemCoordinate,
                    frame: 3
                }
            )
        }
        return convertedMission
    }

    loadMissionDefaults(defaultValues) {
        this.aircraftType = defaultValues.aircraftType
        this.defaultTerrainAlt = defaultValues.defaultTerrainAlt
        this.defaultHeading = defaultValues.defaultHeading
        this.defaultFrame = defaultValues.defaultFrame
        this.defaultSpeed = defaultValues.defaultSpeed
        this.defaultWPRadius = defaultValues.defaultWPRadius

        this.domManager.setDefaultValues(defaultValues)
    }

    loadMissionItems(loadedItems) {
        let item
        for (let index = 0; index < loadedItems.length; index++) {
            let loadedItem = loadedItems[index]
            let itemSettings = {
                seq: index,
                manager: this,
                ...loadedItem,
            }
            switch (loadedItem.pointName) {
                case 'waypoint':
                    item = new WaypointItem(itemSettings)
                    break
                case 'loiter':
                    item = new LoiterItem(itemSettings)
                    break
                case 'rtl':
                    break
                case 'land':
                    item = new LandItem(itemSettings)
                    this.domManager.controlItemsOptions(['land', 'vtolLand'], false)
                    this.hasLandPoint = true
                    break
                case 'takeoff':
                    item = new LaunchItem(itemSettings)
                    this.hasLaunchPoint = true
                    this.domManager.setLaunchLatLon(itemSettings.coordinates[0], itemSettings.coordinates[1])
                    break
                case 'changeSpeed':
                    item = new ChangeSpeedItem(itemSettings)
                    break
                case 'roiLocation':
                    item = new ROILocationItem(itemSettings)
                    break
                case 'roiDisable':
                    item = new ROIDisableItem(itemSettings)
                    break
                case 'delay':
                    item = new DelayItem(itemSettings)
                    break
                case 'jump':
                    item = new JumpItem(itemSettings)
                    break
                case 'startVideoCapture':
                    item = new StartVideoCaptureItem(itemSettings)
                    break
                case 'stopVideoCapture':
                    item = new StopVideoCaptureItem(itemSettings)
                    break
                case 'startImageCapture':
                    item = new StartImageCaptureItem(itemSettings)
                    break
                case 'stopImageCapture':
                    item = new StopImageCaptureItem(itemSettings)
                    break
                case 'cameraConfig':
                    item = new CameraConfigItem(itemSettings)
                    break
                case 'vtolTransition':
                    item = new VtolTransition(itemSettings)
                    break
                case 'vtolTakeoff':
                    item = new VtolTakeoff(itemSettings)
                    this.hasLaunchPoint = true
                    this.domManager.setLaunchLatLon(itemSettings.coordinates[0], itemSettings.coordinates[1])
                    break
                case 'vtolLand':
                    item = new VtolLand(itemSettings)
                    break
            }
            const defaultItem = this.domManager.addPoint(item.pointName, index, this)
            item.setupDomItem(defaultItem)

            if (this.managerLocked)
                this.domManager.lockItem(index, true)

            this.missionItems.push(item)
            this.updateConnectedPoints(index)

            if (index === 0) {
                this.updateHomeAdress()
            }

            this.setupDomItem(defaultItem)
            this.domManager.setItemsCount(this.missionItems.length)
            this.updateDistanceAndDuration()
        }
        this.nextPointIndex = loadedItems.length
    }

    missionItemsHealthyCheck() {
        for (const missionItem of this.missionItems) {
            if (!missionItem.itemIsHealthy()) {
                this.domManager.validationError(true, 'Unhealthy')
                this.missionHealthy = false
                return
            }
        }
        this.domManager.validationError(false)
        this.missionHealthy = true
    }

    getMission(droneCords, autopilotType) {
        const launchCartographic = Cesium.Cartographic.fromDegrees(droneCords.lon, droneCords.lat)
        const launchHeight = this.viewer.scene.globe.getHeight(launchCartographic)

        let mission = []
        for (let missionItem of this.missionItems) {
            const missionCommand = missionItem.getMissionCommand(launchHeight, autopilotType)
            mission.push(missionCommand)
        }
        return mission
    }

    takeSnapshot(hideOtherMissions) {  // TODO need rework
        const cropSize = 300
        const inst = this
        let hiddenMissions = undefined

        return new Promise(function (resolve, reject) {
            if (inst.missionItems.length > 0) {
                if (hideOtherMissions) {
                    hiddenMissions = inst.generalManager.hideMissions(inst.id)
                }
                inst.viewer.flyTo(inst.dataSource, {
                    offset: new Cesium.HeadingPitchRange(0.0, Cesium.Math.toRadians(-50), 0),
                    duration: 0.5,
                }).then(function () {
                    inst.viewer.scene.render()
                    inst.viewer.canvas.toBlob(function (blob) {
                        if (hideOtherMissions) {
                            inst.generalManager.showMissions(hiddenMissions)
                        }
                        var canvas = document.getElementById("cropCanvas");
                        canvas.width = cropSize
                        canvas.height = cropSize

                        var ctx = canvas.getContext("2d");

                        var url = URL.createObjectURL(blob);
                        var img = document.createElement("img")

                        img.src = url
                        img.onload = function () {
                            var w = img.width
                            var h = img.height

                            var sx = (w - h) / 2 // Start crop post
                            var sy = 0
                            var sw = h // Crop width
                            var sh = h

                            var dx = 0
                            var dy = 0
                            var dw = cropSize
                            var dh = cropSize

                            ctx.drawImage(img,
                                sx, sy, sw, sh,
                                dx, dy, dw, dh,
                            )

                            canvas.toBlob(function (blob) {
                                resolve(blob)
                            },
                            "image/jpeg",
                            0.6)
                        }
                    },
                    "image/jpeg",
                    0.6);
                })
            }
        })
    }

    updateMissionNumber(newNumber) {
        this.number = newNumber
        this.domManager.updateTagPosition()
    }
}


// https://sandcastle.cesium.com/?src=Clamp%20to%20Terrain.html