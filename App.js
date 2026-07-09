import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, SafeAreaView, ScrollView, Share, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import himnarioData from './himnario.json'; 

let detectoCoritos = false;
const datosClasificados = himnarioData.map((canto, index) => {
  if (index > 0 && canto.numero < himnarioData[index - 1].numero) {
    detectoCoritos = true;
  }
  return { 
    ...canto, 
    id: index.toString(),
    tipo: detectoCoritos ? 'corito' : 'congregacional',
    etiqueta: detectoCoritos ? 'Corito' : 'Congregacional'
  };
});

export default function App() {
  const [busqueda, setBusqueda] = useState('');
  const [cantoSeleccionado, setCantoSeleccionado] = useState(null);
  const [filtro, setFiltro] = useState('todos'); 
  const [tamanoLetra, setTamanoLetra] = useState(18); 
  const [modoOscuro, setModoOscuro] = useState(false);
  
  const [repertorios, setRepertorios] = useState({ 'Favoritos': [] });
  const [datosCargados, setDatosCargados] = useState(false); // <-- NUEVO ESTADO

  // 1. CARGAR DATOS: Se ejecuta una sola vez cuando la app se abre
  useEffect(() => {
    const cargarRepertorios = async () => {
      try {
        const memoria = await AsyncStorage.getItem('mis_repertorios');
        if (memoria !== null) {
          // Si hay datos guardados, los convertimos de texto a código y los usamos
          setRepertorios(JSON.parse(memoria));
        }
      } catch (error) {
        console.log("Error al cargar la memoria: ", error);
      } finally {
        setDatosCargados(true); // Le decimos a la app que ya revisó el disco duro
      }
    };
    
    cargarRepertorios();
  }, []);

  // 2. GUARDAR DATOS: Se ejecuta en automático cada vez que modificas una lista
  useEffect(() => {
    // Solo guardamos si la app ya terminó de cargar, para no sobreescribir por error
    if (datosCargados) {
      const guardarRepertorios = async () => {
        try {
          // Convertimos las listas a texto y las guardamos en el disco duro
          await AsyncStorage.setItem('mis_repertorios', JSON.stringify(repertorios));
        } catch (error) {
          console.log("Error al guardar en memoria: ", error);
        }
      };
      
      guardarRepertorios();
    }
  }, [repertorios, datosCargados]);
  const [modalVisible, setModalVisible] = useState(false);
  const [cantoParaLista, setCantoParaLista] = useState(null);
  const [nuevaListaNombre, setNuevaListaNombre] = useState('');

  const [autoScroll, setAutoScroll] = useState(false);
  const [velocidadScroll, setVelocidadScroll] = useState(1);
  const scrollViewRef = useRef(null);
  const scrollY = useRef(0);

  const colores = modoOscuro ? {
    fondo: '#121212',
    textoPrincipal: '#ffffff',
    textoSecundario: '#aaaaaa',
    tarjeta: '#1e1e1e',
    borde: '#333333',
    botonBg: '#333333',
    botonTexto: '#6ab0ff',
    inputBg: '#2c2c2c',
    modalOverlay: 'rgba(0,0,0,0.8)',
  } : {
    fondo: '#ffffff',
    textoPrincipal: '#333333',
    textoSecundario: '#666666',
    tarjeta: '#ffffff',
    borde: '#eeeeee',
    botonBg: '#e6f2ff',
    botonTexto: '#007AFF',
    inputBg: '#f9f9f9',
    modalOverlay: 'rgba(0,0,0,0.5)',
  };

  const formatearLetra = (texto) => {
    if (!texto) return '';
    return texto.split('\n').map(linea => linea.trim()).join('\n').replace(/\n{3,}/g, '\n\n'); 
  };

  const compartirCanto = async (canto) => {
    try {
      const mensaje = `${canto.numero}.- ${canto.titulo}\n\n${formatearLetra(canto.letra)}\n\n-- Compartido desde Mensajeros del Gran Rey`;
      await Share.share({ message: mensaje });
    } catch (error) {
      console.log("Error al compartir: ", error.message);
    }
  };

  const abrirModalParaCanto = (canto) => {
    setCantoParaLista(canto);
    setModalVisible(true);
  };

  const crearNuevaLista = () => {
    const nombre = nuevaListaNombre.trim();
    if (nombre && !repertorios[nombre]) {
      setRepertorios(prev => ({ ...prev, [nombre]: [] }));
      setNuevaListaNombre('');
    }
  };

  const toggleEnRepertorio = (nombreLista) => {
    if (!cantoParaLista) return;
    const id = cantoParaLista.id;
    setRepertorios(prev => {
      const listaActiva = prev[nombreLista] || [];
      const nuevaLista = listaActiva.includes(id) ? listaActiva.filter(itemId => itemId !== id) : [...listaActiva, id];
      return { ...prev, [nombreLista]: nuevaLista };
    });
  };

  const confirmarEliminarLista = (nombreLista) => {
    Alert.alert(
      "Eliminar Repertorio",
      `¿Estás seguro de que quieres borrar la lista "${nombreLista}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, borrar", 
          style: "destructive",
          onPress: () => {
            const nuevosRepertorios = { ...repertorios };
            delete nuevosRepertorios[nombreLista];
            setRepertorios(nuevosRepertorios);
            
            if (filtro === nombreLista) {
              setFiltro('todos');
            }
          }
        }
      ]
    );
  };

  const cantosFiltrados = datosClasificados.filter((canto) => {
    if (filtro === 'congregacionales' && canto.tipo !== 'congregacional') return false;
    if (filtro === 'coritos' && canto.tipo !== 'corito') return false;
    
    if (!['todos', 'congregacionales', 'coritos'].includes(filtro)) {
      if (!repertorios[filtro]?.includes(canto.id)) return false;
    }

    const textoBusqueda = busqueda.toLowerCase();
    const titulo = canto.titulo ? canto.titulo.toLowerCase() : '';
    const numero = canto.numero ? canto.numero.toString() : '';
    return titulo.includes(textoBusqueda) || numero.includes(textoBusqueda);
  });

  useEffect(() => {
    let intervalo;
    if (autoScroll && cantoSeleccionado) {
      intervalo = setInterval(() => {
        scrollY.current += velocidadScroll;
        scrollViewRef.current?.scrollTo({ y: scrollY.current, animated: false });
      }, 50); 
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [autoScroll, velocidadScroll, cantoSeleccionado]);

  useEffect(() => {
    if (cantoSeleccionado) {
      scrollY.current = 0;
      setAutoScroll(false);
    }
  }, [cantoSeleccionado]);

  const aumentarLetra = () => setTamanoLetra(prev => Math.min(prev + 2, 40));
  const disminuirLetra = () => setTamanoLetra(prev => Math.max(prev - 2, 12));

  const pestanasNavegacion = ['todos', 'congregacionales', 'coritos', ...Object.keys(repertorios)];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colores.fondo }]}>
      
      {/* MODAL DE REPERTORIOS (Ya sin la basurita aquí) */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={[styles.modalFondo, { backgroundColor: colores.modalOverlay }]}>
          <View style={[styles.modalCaja, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
            <Text style={[styles.modalTitulo, { color: colores.textoPrincipal }]}>Tus Repertorios</Text>
            
            <ScrollView style={{ maxHeight: 250, width: '100%', marginBottom: 15 }}>
              {Object.keys(repertorios).map(lista => {
                const estaEnLista = cantoParaLista && repertorios[lista].includes(cantoParaLista.id);
                return (
                  <TouchableOpacity key={lista} style={[styles.opcionLista, { borderBottomColor: colores.borde }]} onPress={() => toggleEnRepertorio(lista)}>
                    <Ionicons name={estaEnLista ? "checkbox" : "square-outline"} size={26} color={estaEnLista ? colores.botonTexto : colores.textoSecundario} />
                    <Text style={[styles.textoOpcionLista, { color: colores.textoPrincipal }]}>{lista}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.crearListaContenedor}>
              <TextInput 
                style={[styles.inputNuevaLista, { backgroundColor: colores.inputBg, color: colores.textoPrincipal, borderColor: colores.borde }]}
                placeholder="Nombre del nuevo evento..."
                placeholderTextColor={colores.textoSecundario}
                value={nuevaListaNombre}
                onChangeText={setNuevaListaNombre}
              />
              <TouchableOpacity style={[styles.botonCrearLista, { backgroundColor: colores.botonTexto }]} onPress={crearNuevaLista}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.botonCerrarModal, { backgroundColor: colores.botonBg }]} onPress={() => setModalVisible(false)}>
              <Text style={[styles.textoBoton, { color: colores.botonTexto }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- PANTALLA DE LECTURA --- */}
      {cantoSeleccionado ? (
        <>
          <View style={styles.barraSuperior}>
            <TouchableOpacity style={[styles.botonRegresar, { backgroundColor: colores.botonBg }]} onPress={() => setCantoSeleccionado(null)}>
              <Ionicons name="arrow-back" size={20} color={colores.botonTexto} />
              <Text style={[styles.textoBoton, { color: colores.botonTexto, marginLeft: 5 }]}>Regresar</Text>
            </TouchableOpacity>
            
            <View style={styles.iconosDerecha}>
              <TouchableOpacity onPress={() => compartirCanto(cantoSeleccionado)} style={styles.botonIcono}>
                <Ionicons name="share-social-outline" size={28} color={colores.textoPrincipal} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => abrirModalParaCanto(cantoSeleccionado)} style={styles.botonIcono}>
                <Ionicons name="bookmark-outline" size={28} color={colores.textoPrincipal} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.panelControles, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}>
            <View style={styles.grupoControl}>
              <TouchableOpacity onPress={() => setAutoScroll(!autoScroll)} style={[styles.botonControl, { backgroundColor: autoScroll ? '#ff4757' : colores.botonBg }]}>
                <Ionicons name={autoScroll ? "pause" : "play"} size={20} color={autoScroll ? "#fff" : colores.botonTexto} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setVelocidadScroll(prev => Math.max(0.5, prev - 0.5))} style={[styles.botonControlPeque, { backgroundColor: colores.botonBg }]}>
                <Text style={{ color: colores.botonTexto, fontWeight: 'bold' }}>-</Text>
              </TouchableOpacity>
              <Text style={{ color: colores.textoSecundario, fontSize: 12 }}>Vel: {velocidadScroll}</Text>
              <TouchableOpacity onPress={() => setVelocidadScroll(prev => Math.min(5, prev + 0.5))} style={[styles.botonControlPeque, { backgroundColor: colores.botonBg }]}>
                <Text style={{ color: colores.botonTexto, fontWeight: 'bold' }}>+</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.grupoControl}>
              <TouchableOpacity onPress={disminuirLetra} style={[styles.botonControl, { backgroundColor: colores.botonBg }]}>
                <Text style={{ color: colores.botonTexto, fontWeight: 'bold', fontSize: 16 }}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={aumentarLetra} style={[styles.botonControl, { backgroundColor: colores.botonBg }]}>
                <Text style={{ color: colores.botonTexto, fontWeight: 'bold', fontSize: 16 }}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.vistaLetra} ref={scrollViewRef} onScrollBeginDrag={() => setAutoScroll(false)} scrollEventThrottle={16}>
            <Text style={[styles.etiquetaLectura, { color: colores.textoSecundario }]}>{cantoSeleccionado.etiqueta}</Text>
            <Text style={[styles.tituloLetra, { color: colores.textoPrincipal }]}>{cantoSeleccionado.numero}.- {cantoSeleccionado.titulo}</Text>
            <Text style={[styles.letra, { fontSize: tamanoLetra, lineHeight: tamanoLetra * 1.5, color: colores.textoPrincipal }]}>
              {formatearLetra(cantoSeleccionado.letra)}
            </Text>
          </ScrollView>
        </>
      ) : (
        /* --- PANTALLA PRINCIPAL --- */
        <>
          <View style={styles.cabeceraPrincipal}>
            <View>
              <Text style={[styles.saludo, { color: colores.textoSecundario }]}>¡Paz de Cristo hermano!</Text>
              <Text style={[styles.tituloApp, { color: colores.textoPrincipal }]}>Mensajeros del Gran Rey</Text>
            </View>
            <TouchableOpacity onPress={() => setModoOscuro(!modoOscuro)} style={styles.botonIcono}>
              <Ionicons name={modoOscuro ? "sunny" : "moon"} size={28} color={colores.textoPrincipal} />
            </TouchableOpacity>
          </View>
          
          {/* NUEVO: Pestañas con la basurita integrada */}
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contenedorFiltrosScroll}>
              {pestanasNavegacion.map(opcion => {
                // Identificamos cuáles son las listas principales que NO se pueden borrar
                const esFiltroBase = ['todos', 'congregacionales', 'coritos', 'Favoritos'].includes(opcion);
                
                return (
                  <TouchableOpacity 
                    key={opcion}
                    style={[
                      styles.botonFiltro, 
                      { 
                        borderColor: colores.botonTexto, 
                        backgroundColor: filtro === opcion ? colores.botonTexto : colores.fondo,
                        flexDirection: 'row', 
                        alignItems: 'center' 
                      }
                    ]} 
                    onPress={() => setFiltro(opcion)}
                  >
                    <Text style={[
                      styles.textoFiltro, 
                      { color: filtro === opcion ? '#fff' : colores.botonTexto }
                    ]}>
                      {opcion.charAt(0).toUpperCase() + opcion.slice(1)}
                    </Text>
                    
                    {/* Basurita solo para las listas personalizadas */}
                    {!esFiltroBase && (
                      <TouchableOpacity 
                        onPress={() => confirmarEliminarLista(opcion)}
                        style={{ marginLeft: 8, paddingHorizontal: 2 }}
                      >
                        <Ionicons 
                          name="trash" 
                          size={16} 
                          color={filtro === opcion ? '#fff' : '#ff4757'} 
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TextInput
            style={[styles.buscador, { backgroundColor: colores.inputBg, color: colores.textoPrincipal, borderColor: colores.borde }]}
            placeholder="Buscar por número o título..."
            placeholderTextColor={colores.textoSecundario}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          
          <FlatList
            data={cantosFiltrados}
            keyExtractor={(item) => item.id} 
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.itemCanto, { borderBottomColor: colores.borde }]} onPress={() => setCantoSeleccionado(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.textoItem, { color: colores.textoPrincipal }]}>{item.numero}.- {item.titulo}</Text>
                  {['todos', ...Object.keys(repertorios)].includes(filtro) && (
                    <Text style={[styles.subtituloItem, { color: colores.textoSecundario }]}>{item.etiqueta}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => abrirModalParaCanto(item)} style={{ padding: 5 }}>
                  <Ionicons name="bookmark-outline" size={24} color={colores.textoSecundario} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 45 },
  cabeceraPrincipal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  saludo: { fontSize: 14, fontStyle: 'italic' },
  tituloApp: { fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  botonIcono: { padding: 5 },
  contenedorFiltrosScroll: { paddingHorizontal: 15, paddingBottom: 15, gap: 10 },
  botonFiltro: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1 },
  textoFiltro: { fontWeight: '600', fontSize: 14 },
  buscador: { height: 50, borderWidth: 1, borderRadius: 10, marginHorizontal: 15, paddingHorizontal: 15, fontSize: 16, marginBottom: 10 },
  itemCanto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  textoItem: { fontSize: 18, fontWeight: '500' },
  subtituloItem: { fontSize: 12, marginTop: 4 },
  barraSuperior: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, marginBottom: 10 },
  botonRegresar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  textoBoton: { fontSize: 16, fontWeight: 'bold' },
  iconosDerecha: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  panelControles: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 15, marginBottom: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  grupoControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonControl: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  botonControlPeque: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  vistaLetra: { paddingHorizontal: 20 },
  etiquetaLectura: { textAlign: 'center', fontSize: 14, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
  tituloLetra: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  letra: { paddingBottom: 80, textAlign: 'center' },

  modalFondo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalCaja: { width: '85%', padding: 20, borderRadius: 15, borderWidth: 1 },
  modalTitulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  opcionLista: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingVertical: 12, borderBottomWidth: 1 },
  textoOpcionLista: { fontSize: 18, marginLeft: 10 },
  crearListaContenedor: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 15 },
  inputNuevaLista: { flex: 1, height: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginRight: 10 },
  botonCrearLista: { width: 45, height: 45, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  botonCerrarModal: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 5 },
});