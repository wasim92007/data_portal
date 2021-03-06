import 'vtk.js/Sources/favicon';

import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkAnnotatedCubeActor from 'vtk.js/Sources/Rendering/Core/AnnotatedCubeActor';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
//import vtkHttpDataSetReader from 'vtk.js/Sources/IO/Core/HttpDataSetReader';
import vtkXMLImageDataReader from 'vtk.js/Sources/IO/XML/XMLImageDataReader';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkInteractorStyleImage from 'vtk.js/Sources/Interaction/Style/InteractorStyleImage';
import vtkInteractorStyleTrackballCamera from 'vtk.js/Sources/Interaction/Style/InteractorStyleTrackballCamera';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkOutlineFilter from 'vtk.js/Sources/Filters/General/OutlineFilter';
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';
import vtkResliceCursorWidget from 'vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';

import vtkSphereSource from 'vtk.js/Sources/Filters/Sources/SphereSource';
import {
  ViewTypes,
  CaptureOn,
} from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import { SlabMode } from 'vtk.js/Sources/Imaging/Core/ImageReslice/Constants';

import { getViewPlaneNameFromViewType } from 'vtk.js/Sources/Widgets/Widgets3D/ResliceCursorWidget/helpers';

import { vec3 } from 'gl-matrix';
import controlPanel from './controlPanel.html';

import vtkVolume from 'vtk.js/Sources/Rendering/Core/Volume';
import vtkVolumeMapper from 'vtk.js/Sources/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from 'vtk.js/Sources/Common/DataModel/PiecewiseFunction';
import vtkColorMaps from 'vtk.js/Sources/Rendering/Core/ColorTransferFunction/ColorMaps';

// ----------------------------------------------------------------------------
// Define main attributes
// ----------------------------------------------------------------------------

const viewColors = [
  [1, 0, 0], // sagittal
  [0, 1, 0], // coronal
  [0, 0, 1], // axial
  [0.5, 0.5, 0.5], // 3D
  [0.5, 0.5, 0.5], // 3D
];

const widget = vtkResliceCursorWidget.newInstance();
const widgetState = widget.getWidgetState();
widgetState.setKeepOrthogonality(true);

const showDebugActors = true;

// ----------------------------------------------------------------------------
// Define html structure
// ----------------------------------------------------------------------------

const container = document.querySelector('body');
const table = document.createElement('table');
table.setAttribute('id', 'table');
container.appendChild(table);

// Define first line that will contains control panel
const trLine0 = document.createElement('tr');
trLine0.setAttribute('id', 'line0');
table.appendChild(trLine0);
const controlContainer = document.createElement('div');
trLine0.appendChild(controlContainer);
controlContainer.innerHTML = controlPanel;

const trLine1 = document.createElement('tr');
trLine1.setAttribute('id', 'line1');
table.appendChild(trLine1);

const trLine2 = document.createElement('tr');
trLine2.setAttribute('id', 'line2');
table.appendChild(trLine2);

// ----------------------------------------------------------------------------
// Setup rendering code
// ----------------------------------------------------------------------------

/**
 * Function to create synthetic image data with correct dimensions
 * Can be use for debug
 * @param {Array[Int]} dims
 */
// eslint-disable-next-line no-unused-vars
function createSyntheticImageData(dims) {
  const imageData = vtkImageData.newInstance();
  const newArray = new Uint8Array(dims[0] * dims[1] * dims[2]);
  const s = 0.1;
  imageData.setSpacing(s, s, s);
  imageData.setExtent(0, 127, 0, 127, 0, 127);
  let i = 0;
  for (let z = 0; z < dims[2]; z++) {
    for (let y = 0; y < dims[1]; y++) {
      for (let x = 0; x < dims[0]; x++) {
        newArray[i++] = (256 * (i % (dims[0] * dims[1]))) / (dims[0] * dims[1]);
      }
    }
  }

  const da = vtkDataArray.newInstance({
    numberOfComponents: 1,
    values: newArray,
  });
  da.setName('scalars');

  imageData.getPointData().setScalars(da);

  return imageData;
}

function createRGBStringFromRGBValues(rgb) {
  if (rgb.length !== 3) {
    return 'rgb(0, 0, 0)';
  }
  return `rgb(${(rgb[0] * 255).toString()}, ${(rgb[1] * 255).toString()}, ${(
    rgb[2] * 255
  ).toString()})`;
}

const viewAttributes = [];
widgetState.setOpacity(0.6);

const initialState = {
  XPlaneNormal: widgetState.getXPlaneNormal(),
  YPlaneNormal: widgetState.getYPlaneNormal(),
  ZPlaneNormal: widgetState.getZPlaneNormal(),
};

const sliceTypes = [ViewTypes.YZ_PLANE, ViewTypes.XZ_PLANE, ViewTypes.XY_PLANE];
let view3D_slice = null;
let view3D_volume = null;

for (let i = 0; i < 5; i++) {
  const element = document.createElement('td');

  if (i % 2 === 0) {
    trLine2.appendChild(element);
  } else {
    trLine1.appendChild(element);
  }

  const obj = {
    renderWindow: vtkRenderWindow.newInstance(),
    renderer: vtkRenderer.newInstance(),
    GLWindow: vtkOpenGLRenderWindow.newInstance(),
    interactor: vtkRenderWindowInteractor.newInstance(),
    widgetManager: vtkWidgetManager.newInstance(),
  };

  if (i < 4) {
  obj.renderer.getActiveCamera().setParallelProjection(true);
  }
  obj.renderer.setBackground(...viewColors[i]);
  obj.renderWindow.addRenderer(obj.renderer);
  obj.renderWindow.addView(obj.GLWindow);
  obj.renderWindow.setInteractor(obj.interactor);
  obj.GLWindow.setContainer(element);
  obj.interactor.setView(obj.GLWindow);
  obj.interactor.initialize();
  obj.interactor.bindEvents(element);
  obj.widgetManager.setRenderer(obj.renderer);
  if (i < 3) {
    obj.interactor.setInteractorStyle(vtkInteractorStyleImage.newInstance());
    obj.widgetInstance = obj.widgetManager.addWidget(widget, sliceTypes[i]);
    obj.widgetManager.enablePicking();
    // Use to update all renderers buffer when actors are moved
    obj.widgetManager.setCaptureOn(CaptureOn.MOUSE_MOVE);
  } else {
    obj.interactor.setInteractorStyle(
      vtkInteractorStyleTrackballCamera.newInstance()
    );
  }

  if (i < 4) {
    obj.reslice = vtkImageReslice.newInstance();
    obj.reslice.setSlabMode(SlabMode.MEAN);
    obj.reslice.setSlabNumberOfSlices(1);
    obj.reslice.setTransformInputSampling(false);
    obj.reslice.setAutoCropOutput(true);
    obj.reslice.setOutputDimensionality(2);
    obj.resliceMapper = vtkImageMapper.newInstance();
    obj.resliceMapper.setInputConnection(obj.reslice.getOutputPort());
    obj.resliceActor = vtkImageSlice.newInstance();
    obj.resliceActor.setMapper(obj.resliceMapper);
    obj.sphereActors = [];
    obj.sphereSources = [];

    // Create sphere for each 2D views which will be displayed in 3D
    // Define origin, point1 and point2 of the plane used to reslice the volume
    for (let j = 0; j < 3; j++) {
      const sphere = vtkSphereSource.newInstance();
      sphere.setRadius(10);
      const mapper = vtkMapper.newInstance();
      mapper.setInputConnection(sphere.getOutputPort());
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);
      actor.getProperty().setColor(...viewColors[i]);
      actor.setVisibility(showDebugActors);
      obj.sphereActors.push(actor);
      obj.sphereSources.push(sphere);
    }
  }

  if (i < 3) {
    viewAttributes.push(obj);
  } else if (i === 3) {
    view3D_slice = obj;
  } else {
    view3D_volume = obj;
  }

  // create axes
  const axes = vtkAnnotatedCubeActor.newInstance();
  axes.setDefaultStyle({
    text: '+X',
    fontStyle: 'bold',
    fontFamily: 'Arial',
    fontColor: 'black',
    fontSizeScale: (res) => res / 2,
    faceColor: createRGBStringFromRGBValues(viewColors[0]),
    faceRotation: 0,
    edgeThickness: 0.1,
    edgeColor: 'black',
    resolution: 400,
  });
  // axes.setXPlusFaceProperty({ text: '+X' });
  axes.setXMinusFaceProperty({
    text: '-X',
    faceColor: createRGBStringFromRGBValues(viewColors[0]),
    faceRotation: 90,
    fontStyle: 'italic',
  });
  axes.setYPlusFaceProperty({
    text: '+Y',
    faceColor: createRGBStringFromRGBValues(viewColors[1]),
    fontSizeScale: (res) => res / 4,
  });
  axes.setYMinusFaceProperty({
    text: '-Y',
    faceColor: createRGBStringFromRGBValues(viewColors[1]),
    fontColor: 'white',
  });
  axes.setZPlusFaceProperty({
    text: '+Z',
    faceColor: createRGBStringFromRGBValues(viewColors[2]),
  });
  axes.setZMinusFaceProperty({
    text: '-Z',
    faceColor: createRGBStringFromRGBValues(viewColors[2]),
    faceRotation: 45,
  });

  // create orientation widget
  const orientationWidget = vtkOrientationMarkerWidget.newInstance({
    actor: axes,
    interactor: obj.renderWindow.getInteractor(),
  });
  orientationWidget.setEnabled(true);
  orientationWidget.setViewportCorner(
    vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
  );
  orientationWidget.setViewportSize(0.15);
  orientationWidget.setMinPixelSize(100);
  orientationWidget.setMaxPixelSize(300);
}

// ----------------------------------------------------------------------------
// Load image
// ----------------------------------------------------------------------------

function updateReslice(
  interactionContext = {
    viewType: '',
    reslice: null,
    actor: null,
    renderer: null,
    resetFocalPoint: false, // Reset the focal point to the center of the display image
    keepFocalPointPosition: false, // Defines if the focal point position is kepts (same display distance from reslice cursor center)
    computeFocalPointOffset: false, // Defines if the display offset between reslice center and focal point has to be
    // computed. If so, then this offset will be used to keep the focal point position during rotation.
    spheres: null,
    resetViewUp: false, // Defines if the camera view up is projected on plane (resetViewUp = false) or if we use the image bounds (resetViewUp = true)
  }
) {
  const obj = widget.updateReslicePlane(
    interactionContext.reslice,
    interactionContext.viewType
  );
  if (obj.modified) {
    // Get returned modified from setter to know if we have to render
    interactionContext.actor.setUserMatrix(
      interactionContext.reslice.getResliceAxes()
    );
    interactionContext.sphereSources[0].setCenter(...obj.origin);
    interactionContext.sphereSources[1].setCenter(...obj.point1);
    interactionContext.sphereSources[2].setCenter(...obj.point2);
  }
  widget.updateCameraPoints(
    interactionContext.renderer,
    interactionContext.viewType,
    interactionContext.resetFocalPoint,
    interactionContext.keepFocalPointPosition,
    interactionContext.computeFocalPointOffset,
    interactionContext.resetViewUp
  );
  view3D_slice.renderWindow.render();
  return obj.modified;
}

// Read local file
// const vol_input = document.querySelector('input[type="file"]')
const vol_input = document.getElementById('vol_image')
const seg_input = document.getElementById('vol_segment')

vol_input.addEventListener('change', function(e) {
    console.log(vol_input.files)
    const reader = new FileReader()
    reader.onload = function () {
        //const image = reader.getOutputData();
        const vtiReader = vtkXMLImageDataReader.newInstance();
        vtiReader.parseAsArrayBuffer(reader.result);
        const image = vtiReader.getOutputData();
        widget.setImage(image);

        // Create a volume object
        const volume_mapper = vtkVolumeMapper.newInstance();
        volume_mapper.setInputData(image);
        const volume_actor = vtkVolume.newInstance();
        volume_actor.setMapper(volume_mapper);
        const lookupTable = vtkColorTransferFunction.newInstance();
        const piecewiseFun = vtkPiecewiseFunction.newInstance();
        lookupTable.applyColorMap(vtkColorMaps.getPresetByName('Cool to Warm'));
        lookupTable.setMappingRange(0, 256);
        lookupTable.updateRange();
        for (let i = 0; i <= 8; i++) {
          piecewiseFun.addPoint(i * 32, i / 8);
        }
        volume_actor.getProperty().setRGBTransferFunction(0, lookupTable);
        volume_actor.getProperty().setScalarOpacity(0, piecewiseFun);
        const range = image.getPointData().getScalars().getRange();
        lookupTable.setMappingRange(...range);
        lookupTable.updateRange();
        view3D_volume.renderer.addActor(volume_actor);
        view3D_volume.renderer.resetCamera();
        view3D_volume.renderWindow.render();

        // Create image outline in 3D view
        const outline = vtkOutlineFilter.newInstance();
        outline.setInputData(image);
        const outlineMapper = vtkMapper.newInstance();
        outlineMapper.setInputData(outline.getOutputData());
        const outlineActor = vtkActor.newInstance();
        outlineActor.setMapper(outlineMapper);
        view3D_slice.renderer.addActor(outlineActor);

        viewAttributes.forEach((obj, i) => {
          obj.reslice.setInputData(image);
          obj.renderer.addActor(obj.resliceActor);
          view3D_slice.renderer.addActor(obj.resliceActor);
          obj.sphereActors.forEach((actor) => {
            obj.renderer.addActor(actor);
            view3D_slice.renderer.addActor(actor);
          });
          const reslice = obj.reslice;
          const viewType = sliceTypes[i];

          viewAttributes
            // No need to update plane nor refresh when interaction
            // is on current view. Plane can't be changed with interaction on current
            // view. Refreshs happen automatically with `animation`.
            // Note: Need to refresh also the current view because of adding the mouse wheel
            // to change slicer
            .forEach((v) => {
              // Interactions in other views may change current plane
              v.widgetInstance.onInteractionEvent(
                // computeFocalPointOffset: Boolean which defines if the offset between focal point and
                // reslice cursor display center has to be recomputed (while translation is applied)
                // canUpdateFocalPoint: Boolean which defines if the focal point can be updated because
                // the current interaction is a rotation
                ({ computeFocalPointOffset, canUpdateFocalPoint }) => {
                  const activeViewName = widget
                    .getWidgetState()
                    .getActiveViewName();
                  const currentViewName = getViewPlaneNameFromViewType(viewType);
                  const keepFocalPointPosition =
                    activeViewName !== currentViewName && canUpdateFocalPoint;
                  updateReslice({
                    viewType,
                    reslice,
                    actor: obj.resliceActor,
                    renderer: obj.renderer,
                    resetFocalPoint: false,
                    keepFocalPointPosition,
                    computeFocalPointOffset,
                    sphereSources: obj.sphereSources,
                    resetViewUp: false,
                  });
                }
              );
            });

          updateReslice({
            viewType,
            reslice,
            actor: obj.resliceActor,
            renderer: obj.renderer,
            resetFocalPoint: true, // At first initilization, center the focal point to the image center
            keepFocalPointPosition: false, // Don't update the focal point as we already set it to the center of the image
            computeFocalPointOffset: true, // Allow to compute the current offset between display reslice center and display focal point
            sphereSources: obj.sphereSources,
            resetViewUp: true, // Need to be reset the first time the widget is initialized. Then, can be set to false, so that the camera view up will follow the camera
          });
          obj.renderWindow.render();
        });

        view3D_slice.renderer.resetCamera();
        view3D_slice.renderer.resetCameraClippingRange();

        // set max number of slices to slider.
        const maxNumberOfSlices = vec3.length(image.getDimensions());
        document.getElementById('slabNumber').max = maxNumberOfSlices;
    }
    reader.readAsArrayBuffer(vol_input.files[0])


}, false)

seg_input.addEventListener('change', function(e) {
    console.log(seg_input.files)
    const reader = new FileReader()
    reader.onload = function () {
        //const image = reader.getOutputData();
        const vtiReader = vtkXMLImageDataReader.newInstance();
        vtiReader.parseAsArrayBuffer(reader.result);
        const image = vtiReader.getOutputData();
        // widget.setImage(image);

        // Create a volume object
        const volume_mapper = vtkVolumeMapper.newInstance();
        volume_mapper.setInputData(image);
        const volume_actor = vtkVolume.newInstance();
        volume_actor.setMapper(volume_mapper);
        const lookupTable = vtkColorTransferFunction.newInstance();
        const piecewiseFun = vtkPiecewiseFunction.newInstance();
        lookupTable.applyColorMap(vtkColorMaps.getPresetByName('Cool to Warm'));
        lookupTable.setMappingRange(0, 256);
        lookupTable.updateRange();
        for (let i = 0; i <= 8; i++) {
          piecewiseFun.addPoint(i * 8, i / 8);
        }
        volume_actor.getProperty().setRGBTransferFunction(0, lookupTable);
        volume_actor.getProperty().setScalarOpacity(0, piecewiseFun);
        const range = image.getPointData().getScalars().getRange();
        lookupTable.setMappingRange(...range);
        lookupTable.updateRange();
        view3D_volume.renderer.addActor(volume_actor);
        view3D_volume.renderer.resetCamera();
        view3D_volume.renderWindow.render();

        // // Create image outline in 3D view
        // const outline = vtkOutlineFilter.newInstance();
        // outline.setInputData(image);
        // const outlineMapper = vtkMapper.newInstance();
        // outlineMapper.setInputData(outline.getOutputData());
        // const outlineActor = vtkActor.newInstance();
        // outlineActor.setMapper(outlineMapper);
        // view3D_slice.renderer.addActor(outlineActor);

        // viewAttributes.forEach((obj, i) => {
        //   obj.reslice.setInputData(image);
        //   obj.renderer.addActor(obj.resliceActor);
        //   view3D_slice.renderer.addActor(obj.resliceActor);
        //   obj.sphereActors.forEach((actor) => {
        //     obj.renderer.addActor(actor);
        //     view3D_slice.renderer.addActor(actor);
        //   });
        //   const reslice = obj.reslice;
        //   const viewType = sliceTypes[i];

        //   viewAttributes
        //     // No need to update plane nor refresh when interaction
        //     // is on current view. Plane can't be changed with interaction on current
        //     // view. Refreshs happen automatically with `animation`.
        //     // Note: Need to refresh also the current view because of adding the mouse wheel
        //     // to change slicer
        //     .forEach((v) => {
        //       // Interactions in other views may change current plane
        //       v.widgetInstance.onInteractionEvent(
        //         // computeFocalPointOffset: Boolean which defines if the offset between focal point and
        //         // reslice cursor display center has to be recomputed (while translation is applied)
        //         // canUpdateFocalPoint: Boolean which defines if the focal point can be updated because
        //         // the current interaction is a rotation
        //         ({ computeFocalPointOffset, canUpdateFocalPoint }) => {
        //           const activeViewName = widget
        //             .getWidgetState()
        //             .getActiveViewName();
        //           const currentViewName = getViewPlaneNameFromViewType(viewType);
        //           const keepFocalPointPosition =
        //             activeViewName !== currentViewName && canUpdateFocalPoint;
        //           updateReslice({
        //             viewType,
        //             reslice,
        //             actor: obj.resliceActor,
        //             renderer: obj.renderer,
        //             resetFocalPoint: false,
        //             keepFocalPointPosition,
        //             computeFocalPointOffset,
        //             sphereSources: obj.sphereSources,
        //             resetViewUp: false,
        //           });
        //         }
        //       );
        //     });

        //   updateReslice({
        //     viewType,
        //     reslice,
        //     actor: obj.resliceActor,
        //     renderer: obj.renderer,
        //     resetFocalPoint: true, // At first initilization, center the focal point to the image center
        //     keepFocalPointPosition: false, // Don't update the focal point as we already set it to the center of the image
        //     computeFocalPointOffset: true, // Allow to compute the current offset between display reslice center and display focal point
        //     sphereSources: obj.sphereSources,
        //     resetViewUp: true, // Need to be reset the first time the widget is initialized. Then, can be set to false, so that the camera view up will follow the camera
        //   });
        //   obj.renderWindow.render();
        // });

        // view3D_slice.renderer.resetCamera();
        // view3D_slice.renderer.resetCameraClippingRange();

        // // set max number of slices to slider.
        // const maxNumberOfSlices = vec3.length(image.getDimensions());
        // document.getElementById('slabNumber').max = maxNumberOfSlices;
    }
    reader.readAsArrayBuffer(seg_input.files[0])


}, false)

// ----------------------------------------------------------------------------
// Define panel interactions
// ----------------------------------------------------------------------------
function updateViews() {
  viewAttributes.forEach((obj, i) => {
    updateReslice({
      viewType: sliceTypes[i],
      reslice: obj.reslice,
      actor: obj.resliceActor,
      renderer: obj.renderer,
      resetFocalPoint: true,
      keepFocalPointPosition: false,
      computeFocalPointOffset: true,
      sphereSources: obj.sphereSources,
      resetViewUp: true,
    });
    obj.renderWindow.render();
  });
  view3D_slice.renderer.resetCamera();
  view3D_slice.renderer.resetCameraClippingRange();
}

const checkboxOrthogonality = document.getElementById('checkboxOrthogality');
checkboxOrthogonality.addEventListener('change', (ev) => {
  widgetState.setKeepOrthogonality(checkboxOrthogonality.checked);
});

const checkboxRotation = document.getElementById('checkboxRotation');
checkboxRotation.addEventListener('change', (ev) => {
  widgetState.setEnableRotation(checkboxRotation.checked);
});

const checkboxTranslation = document.getElementById('checkboxTranslation');
checkboxTranslation.addEventListener('change', (ev) => {
  widgetState.setEnableTranslation(checkboxTranslation.checked);
});

const optionSlabModeMin = document.getElementById('slabModeMin');
optionSlabModeMin.value = SlabMode.MIN;
const optionSlabModeMax = document.getElementById('slabModeMax');
optionSlabModeMax.value = SlabMode.MAX;
const optionSlabModeMean = document.getElementById('slabModeMean');
optionSlabModeMean.value = SlabMode.MEAN;
const optionSlabModeSum = document.getElementById('slabModeSum');
optionSlabModeSum.value = SlabMode.SUM;
const selectSlabMode = document.getElementById('slabMode');
selectSlabMode.addEventListener('change', (ev) => {
  viewAttributes.forEach((obj) => {
    obj.reslice.setSlabMode(Number(ev.target.value));
  });
  updateViews();
});

const sliderSlabNumberofSlices = document.getElementById('slabNumber');
sliderSlabNumberofSlices.addEventListener('change', (ev) => {
  const trSlabNumberValue = document.getElementById('slabNumberValue');
  trSlabNumberValue.innerHTML = ev.target.value;
  viewAttributes.forEach((obj) => {
    obj.reslice.setSlabNumberOfSlices(ev.target.value);
  });
  updateViews();
});

const buttonReset = document.getElementById('buttonReset');
buttonReset.addEventListener('click', () => {
  widgetState.setXPlaneNormal(initialState.XPlaneNormal);
  widgetState.setYPlaneNormal(initialState.YPlaneNormal);
  widgetState.setZPlaneNormal(initialState.ZPlaneNormal);
  widget.setCenter(widget.getWidgetState().getImage().getCenter());
  updateViews();
});