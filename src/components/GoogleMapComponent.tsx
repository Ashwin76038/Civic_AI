/// <reference types="@types/google.maps" />
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { useCallback, useState } from 'react';

const containerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 11.0168, 
  lng: 76.9558,
};

interface GoogleMapComponentProps {
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number } | null;
}

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ onLocationSelect, initialLocation }) => {
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number }>(
    initialLocation || defaultCenter
  );

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setMarkerPosition({ lat, lng });

      if (onLocationSelect) {
        onLocationSelect({ lat, lng });
      }
    }
  }, [onLocationSelect]);

  return (
    <LoadScript googleMapsApiKey="AIzaSyBHTAoCzVWQgkiorU-aIFhaPbEwqIV4lGI">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={markerPosition}
        zoom={15}
        onClick={handleMapClick}
      >
        <Marker position={markerPosition} />
      </GoogleMap>
    </LoadScript>
  );
};

export default GoogleMapComponent;0