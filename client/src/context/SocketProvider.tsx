import React,{createContext,useMemo,useContext} from 'react';
import {io, Socket} from 'socket.io-client';
import { SOCKET_URL } from '../config';

const SocketContext = createContext<Socket | null>(null);

export const useSocket = () => {
    const socket = useContext(SocketContext);;
    return socket;
}

export const SocketProvider = (props) => {
    const socket = useMemo(()=> io(SOCKET_URL), []);
    return (
        <SocketContext.Provider value={socket}>
            {props.children}
            </SocketContext.Provider>
    )
}