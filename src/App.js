import React from 'react';
import './App.scss';
import { createStore, combineReducers } from 'redux';
import { Provider } from 'react-redux';
import SdkMap from '@boundlessgeo/sdk/components/map';
import SdkMapReducer from '@boundlessgeo/sdk/reducers/map';
import * as mapActions from '@boundlessgeo/sdk/actions/map';
import SdkPopup from '@boundlessgeo/sdk/components/map/popup';

const store = createStore(combineReducers({
  'map': SdkMapReducer,
}), window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__());

/** A popup for marking features when they
 *  are selected.
 */


/**  LONG CLICK TEST CODE
 *  this.handleButtonPress = this.handleButtonPress.bind(this)
 *  this.handleButtonRelease = this.handleButtonRelease.bind(this)
 *   handleButtonPress() {
 *      console.log('press');
 *      this.buttonPressTimer = setTimeout(() => alert('long press activated'), 1500);
 *    }
 *
 *   handleButtonRelease() {
 *      console.log('release');
 *      clearTimeout(this.buttonPressTimer);
 *    }
 *         onTouchStart={this.handleButtonPress}
 *      onTouchEnd={this.handleButtonRelease}
 *      onMouseDown={this.handleButtonPress}
 *      onMouseUp={this.handleButtonRelease}
 *      onMouseLeave={this.handleButtonRelease}
 */
class MarkFeaturesPopup extends SdkPopup {

  constructor(props) {
    super(props);
    this.state = {
      test: true
    }
    this.markFeatures = this.markFeatures.bind(this);
    this.movePopup = this.movePopup.bind(this);
  }
  movePopup(evt) {
    console.log(evt)
  }
  markFeatures(evt) {
    const feature_ids = [];
    const features = this.props.features;

    for (let i = 0, ii = features.length; i < ii; i++) {
      // create an array of ids to be removed from the map.
      feature_ids.push(features[i].properties.id);
      // set the feature property to "marked".
      features[i].properties.isMarked = true;
    }

    // remove the old unmarked features
    store.dispatch(mapActions.removeFeatures('points', ['in', 'id'].concat(feature_ids)));
    // add the new freshly marked features.
    store.dispatch(mapActions.addFeatures('points', features));
    // close this popup.
    this.close(evt);
  }

  render() {
    const feature_ids = this.props.features.map(f => f.properties.id);

    return this.renderPopup((
      <div className='sdk-popup-content custom-popup'>
        <button ref={(c) => {
          if (c) {
            c.addEventListener('click', this.movePopup);
          }
        }}>Move Popup</button>
        You clicked here:<br />
        <code>
          {this.props.coordinate.hms}
        </code>
        <br />
        <p>
          Feature ID(s):<br />
          <code>{feature_ids.join(', ')}</code>
          <br />
        </p>
      </div>
    ));
  }
}

class App extends React.Component {
  componentDidMount() {
    // Start with a reasonable global view of the map.
    store.dispatch(mapActions.setView([-15, 30], 2));

    // add the OSM source
    store.dispatch(mapActions.addOsmSource('osm'));

    // and an OSM layer.
    // Raster layers need not have any paint styles.
    store.dispatch(mapActions.addLayer({
      id: 'osm',
      source: 'osm',
      type: 'raster',
    }));

    // Add a geojson source to the map.
    store.dispatch(mapActions.addSource('points', {
      type: 'geojson',
      data: {},
    }));

    // add a layer for the random points
    store.dispatch(mapActions.addLayer({
      id: 'random-points',
      source: 'points',
      type: 'circle',
      paint: {
        'circle-radius': 5,
        'circle-color': '#756bb1',
        'circle-stroke-color': '#756bb1',
      },
      // filter out any feature which is "marked."
      filter: ['!=', 'isMarked', true],
    }));

    // add a layer to render marked points
    store.dispatch(mapActions.addLayer({
      id: 'marked-points',
      source: 'points',
      type: 'circle',
      paint: {
        'circle-radius': 5,
        'circle-color': '#fc9272',
        'circle-stroke-color': '#de2d26',
      },
      // only show features which are "marked" in this layer.
      filter: ['==', 'isMarked', true],
    }));

    // Add 100 random points to the map
    this.addPoints('points', 100);
  }
  /** Handy all around function for adding a random
 *  set of points to the map.
 *  @param {string} sourceName The name of the source to add to.
 *  @param {number} n_points Number of random points to add.
 */
  addPoints(sourceName, n_points = 10) {
    for (let i = 0; i < n_points; i++) {
      // the feature is a normal GeoJSON feature definition
      store.dispatch(mapActions.addFeatures(sourceName, [{
        type: 'Feature',
        properties: {
          id: `point${i}`,
          title: 'Random Point',
        },
        geometry: {
          type: 'Point',
          // this generates a point somewhere on the planet, unbounded.
          coordinates: [(Math.random() * 360) - 180, (Math.random() * 180) - 90],
        },
      }]));
    }
  }
  render() {
    return (
      <div className="App">
        <Provider store={store}>
          <SdkMap className="map"
            includeFeaturesOnClick
            onClick={(map, xy, featuresPromise) => {
              featuresPromise.then((featureGroups) => {
                // setup an array for all the features returned in the promise.
                let features = [];

                // featureGroups is an array of objects. The key of each object
                // is a layer from the map.
                for (let g = 0, gg = featureGroups.length; g < gg; g++) {
                  // collect every feature from each layer.
                  const layers = Object.keys(featureGroups[g]);
                  for (let l = 0, ll = layers.length; l < ll; l++) {
                    const layer = layers[l];
                    features = features.concat(featureGroups[g][layer]);
                  }
                }

                // Remove all popups from the map
                for (var popup in map.popups) {
                  map.removePopup(popup)
                }
                // xy[0] = xy[0] + 10;

                if (features.length === 0) {
                  // no features, :( Let the user know nothing was there.
                  map.addPopup(<MarkFeaturesPopup coordinate={xy} features={features} closeable><i>No features found.</i></MarkFeaturesPopup>);
                } else {
                  map.addPopup(<MarkFeaturesPopup coordinate={xy} features={features} closeable><i>Feature {features[0].properties.id} found</i></MarkFeaturesPopup>);
                }
              }).catch((exception) => {
                console.error('An error occurred.', exception);
              });
            }}
          />
        </Provider>
      </div>
    );
  }
}
export default App;
